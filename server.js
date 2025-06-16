const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use('/', express.static('./')); // 设置静态资源访问路径
const port = 3001;

// 全局cookie存储
let globalCookies = '';

// 缓存存储 - 按日期分组的内存缓存
const dailyCache = new Map();

// 缓存文件路径
const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'daily-cache.json');

// 延迟保存定时器
let saveTimer = null;

// 获取今天的日期字符串（YYYY-MM-DD格式）
function getTodayDateString() {
  const today = new Date();
  return today.getFullYear() + '-' + 
         String(today.getMonth() + 1).padStart(2, '0') + '-' + 
         String(today.getDate()).padStart(2, '0');
}

// 确保缓存目录存在
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('创建缓存目录:', CACHE_DIR);
  }
}

// 加载缓存文件
function loadCacheFromFile() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const today = getTodayDateString();
      
      // 只加载今日的缓存数据
      for (const [key, value] of Object.entries(cacheData)) {
        if (value.date === today) {
          dailyCache.set(key, value);
        }
      }
      
      console.log(`从文件加载 ${dailyCache.size} 条当日缓存`);
    } else {
      console.log('缓存文件不存在，从空缓存开始');
    }
  } catch (error) {
    console.error('加载缓存文件失败:', error.message);
  }
}

// 保存缓存到文件
function saveCacheToFile() {
  try {
    ensureCacheDir();
    const cacheObject = {};
    for (const [key, value] of dailyCache.entries()) {
      cacheObject[key] = value;
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheObject, null, 2), 'utf8');
    console.log(`缓存已保存到文件，共 ${dailyCache.size} 条记录`);
  } catch (error) {
    console.error('保存缓存文件失败:', error.message);
  }
}

// 清理过期缓存（非今日的缓存）
function cleanExpiredCache() {
  const today = getTodayDateString();
  let cleanedCount = 0;
  
  for (const [key, value] of dailyCache.entries()) {
    if (value.date !== today) {
      dailyCache.delete(key);
      cleanedCount++;
      console.log(`清理过期缓存: ${key}`);
    }
  }
  
  if (cleanedCount > 0) {
    // 如果清理了缓存，更新文件
    saveCacheToFile();
  }
}

// 获取缓存
function getCache(key) {
  const today = getTodayDateString();
  const cached = dailyCache.get(key);
  
  if (cached && cached.date === today) {
    console.log(`缓存命中: ${key}`);
    return cached.data;
  }
  
  return null;
}

// 设置缓存
function setCache(key, data) {
  const today = getTodayDateString();
  dailyCache.set(key, {
    date: today,
    data: data,
    timestamp: new Date().toISOString()
  });
  console.log(`设置缓存: ${key}`);
  
  // 清除之前的定时器
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  
  // 设置20秒后保存到文件
  saveTimer = setTimeout(() => {
    console.log('延迟保存缓存到文件...');
    saveCacheToFile();
    saveTimer = null;
  }, 5 * 1000); // 5秒后执行
}

// 基本的CORS配置
app.use(cors({
  origin: '*', // 允许所有来源（开发环境使用）
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const headers =  {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
        'Referer': 'https://kyfw.12306.cn/otn/leftTicket/init',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }

// 获取12306初始化cookie
async function initializeCookies() {
  try {
    console.log('正在获取12306初始化cookie...');
    const initUrl = 'https://kyfw.12306.cn/otn/leftTicket/init?linktypeid=dc&fs=%E5%8C%97%E4%BA%AC,BJP&ts=%E9%95%BF%E6%B2%99,CSQ&&flag=N,N,Y';
    
    const response = await axios.get(initUrl, {headers,timeout: 15000});
    
    // 提取cookie
    if (response.headers['set-cookie']) {
      globalCookies = response.headers['set-cookie'].join('; ');
      console.log('成功获取cookie:', globalCookies.substring(0, 100) + '...');
    }
    
    return true;
  } catch (error) {
    console.error('获取初始化cookie失败:', error.message);
    return false;
  }
}

// 测试端点
app.get('/test', (req, res) => {
  res.json({ message: '代理服务器运行正常', timestamp: new Date().toISOString() });
});

// 缓存状态端点
app.get('/api/cache-status', (req, res) => {
  const today = getTodayDateString();
  const cacheEntries = Array.from(dailyCache.entries()).map(([key, value]) => ({
    key: key,
    date: value.date,
    isToday: value.date === today,
    timestamp: value.timestamp
  }));
  
  res.json({
    currentDate: today,
    totalCacheEntries: dailyCache.size,
    todayCacheEntries: cacheEntries.filter(entry => entry.isToday).length,
    cacheEntries: cacheEntries
  });
});

// 获取车站代码
app.get('/api/station-codes', async (req, res) => {
  try {
    console.log('获取车站代码...');
    
    // 先检查缓存
    const cacheKey = 'station-codes';
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      res.set('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(cachedData);
    }
    
    // 如果没有cookie，先获取
    if (!globalCookies) {
      console.log('没有cookie，正在初始化...');
      await initializeCookies();
    }
    
    // 添加cookie
    if (globalCookies) {
      headers['Cookie'] = globalCookies;
    }
    
    const response = await axios.get('https://kyfw.12306.cn/otn/resources/js/framework/station_name.js', {
      headers,
      timeout: 10000
    });
    
    // 缓存成功获取的数据
    setCache(cacheKey, response.data);
    
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    res.send(response.data);
  } catch (error) {
    console.error('获取车站代码失败:', error.message);
    res.status(500).json({ error: '获取车站代码失败', message: error.message });
  }
});

// 查询列车
app.get('/api/query-trains', async (req, res) => {
  try {
    const { from_station, to_station, train_date } = req.query;
    
    if (!from_station || !to_station || !train_date) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['from_station', 'to_station', 'train_date'] 
      });
    }
    
    // 生成缓存键
    const cacheKey = `query-trains:${from_station}:${to_station}:${train_date}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // 如果没有cookie，先获取
    if (!globalCookies) {
      console.log('没有cookie，正在初始化...');
      await initializeCookies();
    }
    
    console.log(`查询列车: ${from_station} -> ${to_station} 日期: ${train_date}`);
    
    const url = 'https://kyfw.12306.cn/otn/leftTicket/queryU';
    const params = {
      'leftTicketDTO.train_date': train_date,
      'leftTicketDTO.from_station': from_station,
      'leftTicketDTO.to_station': to_station,
      'purpose_codes': 'ADULT'
    };
    
    // 添加cookie
    if (globalCookies) {
      headers['Cookie'] = globalCookies;
    }
    
    const response = await axios.get(url, {
      params,
      headers,
      timeout: 15000
    });
    
    // 缓存成功获取的数据
    if (response.data && response.data.status === true) {
      setCache(cacheKey, response.data);
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('查询列车失败:', error.message);
    
    // 如果是401或403错误，重新获取cookie
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log('认证失败，重新获取cookie...');
      globalCookies = '';
    }
    
    res.status(500).json({ error: '查询列车失败', message: error.message });
  }
});

// 获取车站大屏数据 - 方法2 (中国铁路)
app.post('/api/station-screen-ccrgt', async (req, res) => {
  try {
    const { stationCode, type = 'D' } = req.body;
    
    if (!stationCode) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['stationCode'] 
      });
    }
    
    // 生成缓存键
    const cacheKey = `station-screen-ccrgt:${stationCode}:${type}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    console.log(`查询车站大屏数据 (中国铁路): ${stationCode}, 类型: ${type}`);
    
    const url = 'https://tripapi.ccrgt.com/crgt/trip-server-app/screen/getStationScreenByStationCode';
    
    // 构建请求数据
    const requestData = {
      params: {
        stationCode: stationCode,
        type: type
      },
      isSign: 0
    };
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Origin': 'https://tripapi.ccrgt.com',
      'Referer': 'https://tripapi.ccrgt.com/'
    };
      const response = await axios.post(url, requestData, {
      headers,
      timeout: 15000
    });
    
    // 使用统一格式转换
    const normalizedData = normalizeStationScreenData(response.data, 'ccrgt', { stationCode, type });
    
    // 缓存统一格式的数据
    if (normalizedData.success) {
      setCache(cacheKey, normalizedData);
    }
    
    res.json(normalizedData);
  } catch (error) {
    console.error('查询车站大屏数据失败 (中国铁路):', error.message);
    res.status(500).json({ 
      error: '查询车站大屏数据失败', 
      message: error.message,
      provider: 'ccrgt' 
    });
  }
});

// 随机字符串生成函数
function generateRandomString(length) {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomNumber(length) {
  return generateRandomString(length);
}

// 统一车站大屏数据格式转换函数
function normalizeStationScreenData(rawData, provider, requestParams) {
  const timestamp = new Date().toISOString();
  
  // 统一的响应格式
  const normalizedResponse = {
    success: false,
    provider: provider,
    timestamp: timestamp,
    requestParams: requestParams,
    data: {
      stationName: requestParams.stationName || requestParams.stationCode || '',
      screenType: requestParams.screenFlag !== undefined ? (requestParams.screenFlag === 0 ? 'departure' : 'arrival') : 
                  (requestParams.type === 'D' ? 'departure' : 'arrival'),
      trains: [],
      totalCount: 0
    },
    rawData: rawData
  };
  try {
    if (provider === 'ccrgt') {
      // 处理中国铁路API返回的数据
      if (rawData && rawData.code === 0 && rawData.data && Array.isArray(rawData.data.list)) {
        normalizedResponse.success = true;
        normalizedResponse.data.totalCount = rawData.data.list.length;
        normalizedResponse.data.trains = rawData.data.list.map(train => {
          // 确保时间使用中国时区（Asia/Shanghai）避免服务器时区差异
          const date = new Date(train.startDepartTime * 1000);
          const chinaTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
          const hours = String(chinaTime.getHours()).padStart(2, '0');
          const minutes = String(chinaTime.getMinutes()).padStart(2, '0');
          
          return {
            trainNo: train.trainCode || '',
            endStation: train.endStation || '',
            checkIn: train.wicket || '',
            departureTime: `${hours}:${minutes}`,
            status: train.status || '',
            // 1候车 2检票 3已开 
          };
        });
      }
    } else if (provider === 'suanya') {
      // 处理苏州快享API返回的数据
      if (rawData && rawData.ResponseStatus && rawData.ResponseStatus.Ack === 'Success') {
        normalizedResponse.success = true;
        
        const validTrains = [];
        // 处理停止检票的车次
        if (rawData.invalidWaitingScreens && Array.isArray(rawData.invalidWaitingScreens)) {
          validTrains.push(...rawData.invalidWaitingScreens.map(train => ({
            trainNo: train.trainNo || '',
            endStation: train.endStationName || '',
            departureTime: train.departTime || '',
            checkIn: train.checkingPort || '',
            status: train.waitingState || '',
          })));
        }
        // 处理正在检票和候车的车次
        if (rawData.stationWaitingScreens && Array.isArray(rawData.stationWaitingScreens)) {
          validTrains.push(...rawData.stationWaitingScreens.map(train => ({
            trainNo: train.trainNo || '',
            endStation: train.endStationName || '',
            departureTime: train.departTime || '',
            checkIn: train.checkingPort || '',
            status: train.waitingState || '',
          })));
        }


        normalizedResponse.data.trains = validTrains;
        normalizedResponse.data.totalCount = validTrains.length;
      }
    }
  } catch (error) {
    console.error(`数据格式转换失败 (${provider}):`, error.message);
    normalizedResponse.error = `数据格式转换失败: ${error.message}`;
  }

  return normalizedResponse;
}

// 获取车站大屏数据 - 方法3 (苏州快享/智行)
app.post('/api/station-screen-suanya', async (req, res) => {
  try {
    const { stationName, screenFlag = 0 } = req.body;
    
    if (!stationName) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['stationName'] 
      });
    }
    
    // 生成缓存键
    const cacheKey = `station-screen-suanya:${stationName}:${screenFlag}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    console.log(`查询车站大屏数据 (苏州快享): ${stationName}, 屏幕标志: ${screenFlag}`);
    
    // 生成随机字符串，严格按照Python代码实现
    const randomStr = generateRandomString(20);
    const currentTimeMs = Math.floor(Date.now()); // 毫秒级时间戳
    const randomNum7 = generateRandomNumber(7);
    
    const url = 'https://m.suanya.com/restapi/soa2/24635/getScreenStationData';
    
    // 构建请求参数 - 严格按照Python代码格式
    const params = {
      "_fxpcqlniredt": randomStr,
      "x-traceID": `${randomStr}-${currentTimeMs}-${randomNum7}`
    };
    
    // 严格按照Python代码的数据结构
    const requestData = {
      "stationName": stationName,
      "screenFlag": screenFlag,
      "authentication": {
        "partnerName": "ZhiXing",
        "source": "",
        "platform": "APP"
      },
      "head": {
        "cid": randomStr,
        "ctok": "",
        "cver": "1005.006",
        "lang": "01",
        "sid": "8888",
        "syscode": "32",
        "auth": "",
        "xsid": "",
        "extension": []
      }
    };
    
    // 使用与Python相同的headers
    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Content-Type': 'application/json'
    };
    
    console.log('苏州快享请求参数:', JSON.stringify(params, null, 2));
    console.log('苏州快享请求数据:', JSON.stringify(requestData, null, 2));
    
    const response = await axios.post(url, requestData, {
      params,
      headers,
      timeout: 15000
    });
      console.log('苏州快享响应状态:', response.status);
    console.log('苏州快享响应数据:', JSON.stringify(response.data, null, 2));
    
    // 使用统一格式转换
    const normalizedData = normalizeStationScreenData(response.data, 'suanya', { stationName, screenFlag });
    
    // 缓存统一格式的数据
    if (normalizedData.success) {
      setCache(cacheKey, normalizedData);
    }
    
    res.json(normalizedData);
  } catch (error) {
    console.error('查询车站大屏数据失败 (苏州快享):', error.message);
    if (error.response) {
      console.error('苏州快享错误响应状态:', error.response.status);
      console.error('苏州快享错误响应数据:', error.response.data);
    }
    res.status(500).json({ 
      error: '查询车站大屏数据失败', 
      message: error.message,
      provider: 'suanya',
      details: error.response ? error.response.data : null
    });
  }
});

// 肇庆filiter前置

// 获取列车详情
app.get('/api/train-details', async (req, res) => {
  try {
    const { train_no, from_station_telecode, to_station_telecode, depart_date } = req.query;
    
    if (!train_no || !from_station_telecode || !to_station_telecode || !depart_date) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['train_no', 'from_station_telecode', 'to_station_telecode', 'depart_date'] 
      });
    }
    
    // 生成缓存键
    const cacheKey = `train-details:${train_no}:${depart_date}`;
    const cachedData = getCache(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    // 如果没有cookie，先获取
    if (!globalCookies) {
      console.log('没有cookie，正在初始化...');
      await initializeCookies();
    }
    
    console.log(`查询列车详情: ${train_no}`);
    
    const url = 'https://kyfw.12306.cn/otn/czxx/queryByTrainNo';
    const params = {
      train_no,
      from_station_telecode,
      to_station_telecode,
      depart_date
    };
    
    // 添加cookie
    if (globalCookies) {
      headers['Cookie'] = globalCookies;
    }
    
    const response = await axios.get(url, {
      params,
      headers,
      timeout: 15000
    });
    
    // 缓存成功获取的数据
    if (response.data && response.data.status === true) {
      setCache(cacheKey, response.data);
    }
      res.json(response.data);
  } catch (error) {
    console.error('查询列车详情失败:', error.message);
    res.status(500).json({ error: '查询列车详情失败', message: error.message });
  }
});

app.listen(port, async () => {
  console.log(`=================================`);
  console.log(`12306 代理服务器已启动!`);
  console.log(`监听端口: http://localhost:${port}`);
  console.log(`测试地址: http://localhost:${port}/test`);
  console.log(`缓存状态: http://localhost:${port}/api/cache-status`);
  console.log(`=================================`);
  
  // 启动时先加载缓存文件
  console.log('加载持久化缓存...');
  loadCacheFromFile();
  
  // 启动时初始化cookie
  console.log('正在初始化12306 cookie...');
  await initializeCookies();
  console.log('初始化完成!');
    // 启动时清理过期缓存
  console.log('清理过期缓存...');
  cleanExpiredCache();
  
  // 设置定时器，每小时清理一次过期缓存
  setInterval(() => {
    console.log('定时清理过期缓存...');
    cleanExpiredCache();
  }, 60 * 60 * 1000); // 每小时执行一次
  
  console.log('缓存系统已启用，当日数据将被缓存以提高响应速度');
  console.log(`缓存文件位置: ${CACHE_FILE}`);
  console.log('延迟保存: 每次查询结束20秒后保存缓存到文件');
});

// 统一车站大屏API - 自动选择最佳后端API
app.post('/api/station-screen', async (req, res) => {
  try {
    let { stationName, stationCode, screenType = 'departure', provider = 'auto' } = req.body;
    
    // 参数兼容性处理
    if (!stationName && !stationCode) {
      return res.status(400).json({ 
        error: '缺少必要参数', 
        required: ['stationName 或 stationCode'],
        description: 'stationName用于苏州快享API，stationCode用于中国铁路API'
      });
    }
    
    let selectedProvider = provider;
    
    // 自动选择API提供商
    if (provider === 'auto') {
      if (stationCode && !stationName) {
        selectedProvider = 'ccrgt';
      } else if (stationName && !stationCode) {
        selectedProvider = 'suanya';
      } else {
        // 如果两个参数都有或者根据参数格式判断
        const isCodeFormat = /^[A-Z]{3}$/.test(stationName || stationCode);
        selectedProvider = isCodeFormat ? 'ccrgt' : 'suanya';
      }
    }
    
    console.log(`统一车站大屏API: 选择提供商=${selectedProvider}, 车站=${stationName || stationCode}, 类型=${screenType}`);
    
    let result;
    
    if (selectedProvider === 'ccrgt') {
      // 使用中国铁路API
      const type = screenType === 'departure' ? 'D' : 'A';
      const stationCodeParam = stationCode || stationName;
      
      const cacheKey = `station-screen-ccrgt:${stationCodeParam}:${type}`;
      const cachedData = getCache(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      const url = 'https://tripapi.ccrgt.com/crgt/trip-server-app/screen/getStationScreenByStationCode';
      const requestData = {
        params: {
          stationCode: stationCodeParam,
          type: type
        },
        isSign: 0
      };
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://tripapi.ccrgt.com',
        'Referer': 'https://tripapi.ccrgt.com/'
      };
      
      const response = await axios.post(url, requestData, {
        headers,
        timeout: 15000
      });
      
      result = normalizeStationScreenData(response.data, 'ccrgt', { stationCode: stationCodeParam, type });
      
    } else if (selectedProvider === 'suanya') {
      // 使用苏州快享API
      const screenFlag = screenType === 'departure' ? 0 : 1;
      const stationNameParam = stationName || stationCode;
      
      const cacheKey = `station-screen-suanya:${stationNameParam}:${screenFlag}`;
      const cachedData = getCache(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      const randomStr = generateRandomString(20);
      const currentTimeMs = Math.floor(Date.now());
      const randomNum7 = generateRandomNumber(7);
      
      const url = 'https://m.suanya.com/restapi/soa2/24635/getScreenStationData';
      
      const params = {
        "_fxpcqlniredt": randomStr,
        "x-traceID": `${randomStr}-${currentTimeMs}-${randomNum7}`
      };
      
      const requestData = {
        "stationName": stationNameParam,
        "screenFlag": screenFlag,
        "authentication": {
          "partnerName": "ZhiXing",
          "source": "",
          "platform": "APP"
        },
        "head": {
          "cid": randomStr,
          "ctok": "",
          "cver": "1005.006",
          "lang": "01",
          "sid": "8888",
          "syscode": "32",
          "auth": "",
          "xsid": "",
          "extension": []
        }
      };
      
      const headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Content-Type': 'application/json'
      };
      
      const response = await axios.post(url, requestData, {
        params,
        headers,
        timeout: 15000
      });
      
      result = normalizeStationScreenData(response.data, 'suanya', { stationName: stationNameParam, screenFlag });
    } else {
      return res.status(400).json({
        error: '不支持的API提供商',
        supportedProviders: ['auto', 'ccrgt', 'suanya']
      });
    }
    
    // 缓存结果
    if (result && result.success) {
      const cacheKey = selectedProvider === 'ccrgt' 
        ? `station-screen-ccrgt:${stationCode || stationName}:${screenType === 'departure' ? 'D' : 'A'}`
        : `station-screen-suanya:${stationName || stationCode}:${screenType === 'departure' ? 0 : 1}`;
      setCache(cacheKey, result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('统一车站大屏API失败:', error.message);
    if (error.response) {
      console.error('错误响应状态:', error.response.status);
      console.error('错误响应数据:', error.response.data);
    }
    res.status(500).json({ 
      error: '查询车站大屏数据失败', 
      message: error.message,
      provider: 'unified',
      details: error.response ? error.response.data : null
    });
  }
});

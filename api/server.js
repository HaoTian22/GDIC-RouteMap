const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
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

// 获取12306初始化cookie
async function initializeCookies() {
  try {
    console.log('正在获取12306初始化cookie...');
    const initUrl = 'https://kyfw.12306.cn/otn/leftTicket/init?linktypeid=dc&fs=%E5%8C%97%E4%BA%AC,BJP&ts=%E9%95%BF%E6%B2%99,CSQ&date=2025-05-25&flag=N,N,Y';
    
    const response = await axios.get(initUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000
    });
    
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
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://kyfw.12306.cn/otn/leftTicket/init'
    };
    
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
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://kyfw.12306.cn/otn/leftTicket/init',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'X-Requested-With': 'XMLHttpRequest'
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
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': 'https://kyfw.12306.cn/otn/leftTicket/init',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest'
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

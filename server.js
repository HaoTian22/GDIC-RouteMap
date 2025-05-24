const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 3001;

// 全局cookie存储
let globalCookies = '';

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

// 获取车站代码
app.get('/api/station-codes', async (req, res) => {
  try {
    console.log('获取车站代码...');
    
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
  console.log(`=================================`);
  
  // 启动时初始化cookie
  console.log('正在初始化12306 cookie...');
  await initializeCookies();
  console.log('初始化完成!');
});

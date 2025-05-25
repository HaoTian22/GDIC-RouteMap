const cors = require('cors');
const axios = require('axios');

// 全局cookie存储
let globalCookies = '';

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

// CORS中间件配置
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = async (req, res) => {
  // 应用CORS
  await new Promise((resolve, reject) => {
    cors(corsOptions)(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
  // 在Vercel中，通过rewrites配置，req.url会包含完整路径
  const { url, method } = req;
  const pathname = url.split('?')[0]; // 获取路径部分，去除查询参数
  
  console.log(`API请求: ${method} ${pathname}`);
  console.log(`完整URL: ${url}`);
  console.log(`Host: ${req.headers.host}`);
  
  try {
    // 路由处理 - 处理/api/前缀的路径
    if (pathname === '/api/test' || pathname === '/api/' || pathname === '/test' || pathname === '/') {
      return res.json({ message: '代理服务器运行正常', timestamp: new Date().toISOString() });
    }
    
    if (pathname === '/api/station-codes' || pathname === '/station-codes') {
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
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      return res.send(response.data);
    }
    
    if (pathname === '/api/query-trains' || pathname === '/query-trains') {
      const urlParams = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const from_station = urlParams.searchParams.get('from_station');
      const to_station = urlParams.searchParams.get('to_station');
      const train_date = urlParams.searchParams.get('train_date');
      
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
      
      const apiUrl = 'https://kyfw.12306.cn/otn/leftTicket/queryU';
      const params = new URLSearchParams({
        'leftTicketDTO.train_date': train_date,
        'leftTicketDTO.from_station': from_station,
        'leftTicketDTO.to_station': to_station,
        'purpose_codes': 'ADULT'
      });
      
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
        const response = await axios.get(`${apiUrl}?${params}`, {
        headers,
        timeout: 15000
      });
      
      return res.json(response.data);
    }
    
    if (pathname === '/api/train-details' || pathname === '/train-details') {
      const urlParams = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const train_no = urlParams.searchParams.get('train_no');
      const from_station_telecode = urlParams.searchParams.get('from_station_telecode');
      const to_station_telecode = urlParams.searchParams.get('to_station_telecode');
      const depart_date = urlParams.searchParams.get('depart_date');
      
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
      
      const apiUrl = 'https://kyfw.12306.cn/otn/czxx/queryByTrainNo';
      const params = new URLSearchParams({
        train_no,
        from_station_telecode,
        to_station_telecode,
        depart_date
      });
      
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
        const response = await axios.get(`${apiUrl}?${params}`, {
        headers,
        timeout: 15000
      });
      
      return res.json(response.data);
    }
    
    // 默认404
    console.log(`未找到路由: ${pathname}`);
    return res.status(404).json({ 
      error: 'API endpoint not found', 
      requested_path: pathname,
      available_endpoints: ['/test', '/station-codes', '/query-trains', '/train-details']
    });
    
  } catch (error) {
    console.error('API请求失败:', error.message);
    
    // 如果是401或403错误，重新获取cookie
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log('认证失败，重新获取cookie...');
      globalCookies = '';
    }
    
    return res.status(500).json({ error: 'API请求失败', message: error.message });
  }
};

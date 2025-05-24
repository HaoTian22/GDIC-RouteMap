// 简单的测试API端点
module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { url, method } = req;
  const pathname = url.split('?')[0];
  
  console.log(`测试API请求: ${method} ${pathname}`);
  
  return res.json({
    message: '测试API正常工作',
    timestamp: new Date().toISOString(),
    method: method,
    pathname: pathname,
    fullUrl: url
  });
};

console.log('测试Node.js和依赖...');

try {
    const express = require('express');
    const cors = require('cors');
    const axios = require('axios');
    
    console.log('✓ 所有依赖包加载成功');
    console.log('Express版本:', require('express/package.json').version);
    console.log('CORS版本:', require('cors/package.json').version);
    console.log('Axios版本:', require('axios/package.json').version);
    
    // 简单测试Express应用
    const app = express();
    app.use(cors());
    
    app.get('/test', (req, res) => {
        res.json({ status: 'ok', message: '服务器正常运行' });
    });
    
    const server = app.listen(3001, () => {
        console.log('✓ 服务器成功启动在端口 3001');
        console.log('测试完成，即将关闭...');
        
        setTimeout(() => {
            server.close();
            console.log('✓ 测试服务器已关闭');
            process.exit(0);
        }, 1000);
    });
    
} catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
}

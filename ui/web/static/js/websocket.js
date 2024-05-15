var ws = null; 
const url = window.location.href;  
const ipAddress = extractIPFromURL(url); 
  
function extractIPFromURL(url) {  
    // 使用正则表达式匹配IP地址  
    const ipRegex = /(\d{1,3}\.){3}\d{1,3}/;  
    const match = url.match(ipRegex);  
        
    // 如果找到匹配项，返回IP地址；否则返回null  
    return match ? match[0] : null;  
} 

function connectWebSocket(ip) {  
  // 假设WebSocket服务器在ws://your-websocket-server-url  
  ws = new WebSocket(`ws://${ip}:63000/websocket`);  
  
  ws.onopen = function(event) {  
    console.log('WebSocket is open now.');  
    // 可以在这里发送初始消息等
    getChannelsAndSendMessage(ip)
  };  
  
  ws.onmessage = function(event) {  
    console.log('Received data from server: ', event.data);  
    // 处理从服务器接收到的数据  
  };  
  
  ws.onclose = function(event) {  
    if (event.wasClean) {  
      console.log('WebSocket closed cleanly, code=' + event.code + ' reason=' + event.reason);  
    } else {  
      // 例如，服务器进程被终止，代码可能不是1000  
      console.error('WebSocket disconnected unexpectedly (code=' + event.code + ' reason=' + event.reason + ')');  
    }  
    // 可以在这里尝试重新连接  
  };  
  
  ws.onerror = function(error) {  
    console.error('WebSocket Error: ', error);  
    connectWebSocket(ip)
  };  
}  

function getChannelsAndSendMessage(ip) {
  fetch(`/ui/channels/channelsInJSON?page=1&limit=100`, {
    method: "GET",
  })
  .then(response => {  
      if (!response.ok) {  
          throw new Error('Network response was not ok');  
      }  
      return response.json(); // 直接将流转换为JSON对象  
  })  
  .then(json => {  
    const data = json.data;
    const channelsData = JSON.parse(data).channelsData;
    const channels = channelsData.groups;
    const urls = channels.map((channel)=> `ws://${ip}:8186/channels/${channel.id}/messages?authorization=platform`);
    const message = {urls: urls.join(';'), message: 'connect'}
    ws.send(JSON.stringify(message))  
  })
}


$(function() {  
    // DOM 加载完成后执行的代码
    if (!containsLoginInUrl()) {  
      connectWebSocket(ipAddress)
    }
});
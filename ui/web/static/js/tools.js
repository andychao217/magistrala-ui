// 密钥（需要是16字节或32字节长，这里是一个16字节长的示例）
var SECRET_KEY = CryptoJS.enc.Utf8.parse(`LFJEW2HvOI9EpI5FmIWE*#&$(HFKDFR0`); // 128位密钥

// 加密函数
function encryptByAesCbc(message, key) {
    // 生成随机的初始化向量（IV）
    const iv = CryptoJS.lib.WordArray.random(16); // 16字节IV
    
    // 使用CryptoJS的AES加密
    const encrypted = CryptoJS.AES.encrypt(
        CryptoJS.enc.Utf8.parse(message),
        key,
        {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );
    
    // 返回Base64编码的密文和IV
    const res =  {
        ciphertext: encrypted.toString(),
        iv: iv.toString(CryptoJS.enc.Base64)
    };
    return res.ciphertext + ":" + res.iv
}

// 解密函数
function decryptByAesCbc(base64String, key) {
    // 将密文和IV从Base64解码
    const base64StringArray = base64String.split(":");
    const ciphertextBase64 = base64StringArray[0];
    const ivBase64 = base64StringArray[1];
    const ciphertextParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Base64.parse(ciphertextBase64)
    });
    const iv = CryptoJS.enc.Base64.parse(ivBase64);
    
    // 使用相同的参数进行解密
    const decrypted = CryptoJS.AES.decrypt(
        ciphertextParams,
        key,
        {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );
    
    // 返回解密后的明文
    return decrypted.toString(CryptoJS.enc.Utf8);
}


// 使用示例
// const message = "12345678";
// const encryptedData = encryptByAesCbc(message, SECRET_KEY);
// console.log("Encrypted:", encryptedData.ciphertext);
// console.log("IV:", encryptedData.iv);

// const decryptedMessage = decryptByAesCbc(encryptedData.ciphertext, SECRET_KEY, encryptedData.iv);
// console.log("Decrypted:", decryptedMessage);


function disconnectThingsAndChannels(thingID, channelID){
    let formData = new FormData();
    formData.append("thingID", thingID);
    formData.append("channelID", channelID);
    fetch(`/ui/channels/disconnect?thingID=${thingID}&channelID=${channelID}`, {
        method: "POST",
        body: formData
    })
    .then(response => {  
        if (!response.ok) {  
            throw new Error('Network response was not ok');  
        }  
        return response.json(); // 直接将流转换为JSON对象  
    })  
    .then(json => {  
        console.error('处理fetch或JSON时出错:');  
    });
}
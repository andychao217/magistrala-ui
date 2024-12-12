// ip v4 正则
const IPV4REGX = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPERRORMSG = "请输入正确的IP地址";
// 密钥（需要是16字节或32字节长，这里是一个16字节长的示例）
const SECRET_KEY = CryptoJS.enc.Utf8.parse(`LFJEW2HvOI9EpI5FmIWE*#&$(HFKDFR0`); // 128位密钥

// 加密函数
function encryptByAesCbc(message, key) {
    // 生成随机的初始化向量（IV）
    const iv = CryptoJS.lib.WordArray.random(16); // 16字节IV

    // 使用CryptoJS的AES加密
    const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(message), key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });

    // 返回Base64编码的密文和IV
    const res = {
        ciphertext: encrypted.toString(),
        iv: iv.toString(CryptoJS.enc.Base64),
    };
    return res.ciphertext + ":" + res.iv;
}

// 解密函数
function decryptByAesCbc(base64String, key) {
    // 将密文和IV从Base64解码
    const base64StringArray = base64String.split(":");
    const ciphertextBase64 = base64StringArray[0];
    const ivBase64 = base64StringArray[1];
    const ciphertextParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Base64.parse(ciphertextBase64),
    });
    const iv = CryptoJS.enc.Base64.parse(ivBase64);

    // 使用相同的参数进行解密
    const decrypted = CryptoJS.AES.decrypt(ciphertextParams, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });

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

function disconnectThingsAndChannels(thingID, channelID) {
    let formData = new FormData();
    formData.append("thingID", thingID);
    formData.append("channelID", channelID);
    fetch(`/ui/channels/disconnect?thingID=${thingID}&channelID=${channelID}`, {
        method: "POST",
        body: formData,
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json(); // 直接将流转换为JSON对象
        })
        .then((json) => {
            console.error("处理fetch或JSON时出错:");
        });
}

function containsLoginInUrl() {
    // 获取完整的URL
    const url = window.location.href;
    // 或者只获取路径部分（不包含域名和查询字符串）
    // const url = window.location.pathname;

    // 检查URL是否包含"login"或者"register"
    if (url.indexOf("login") !== -1 || url.indexOf("register") !== -1) {
        // 如果包含，返回true
        return true;
    }
    // 如果不包含，返回false
    return false;
}

// 解释
// watchVariable 方法：
// 该方法接收一个值 value（可以是对象、数组、字符串、数字或布尔值）和一个回调函数 callback。
// 根据 value 的类型，处理对象、数组或基本数据类型。

// 对象和数组：
// 使用 Proxy 拦截 set 和 deleteProperty 操作。
// 当属性值发生变化或属性被删除时，调用回调函数 callback。

// 基本数据类型（字符串、数字、布尔值）：
// 使用对象包装基本数据类型，并通过 getter 和 setter 拦截值的变化。
// 当值发生变化时，调用回调函数 callback。

// 这种方法可以灵活地监听多种数据类型的变化，并在变化时执行相应的回调函数。
function watchVariable(value, callback) {
    if (typeof value === 'object' && value !== null) {
        // 对象或数组
        return new Proxy(value, {
            set(target, property, newValue, receiver) {
                const oldValue = target[property];
                if (oldValue !== newValue) {
                    target[property] = newValue;
                    callback(target, property, oldValue, newValue);
                }
                return true; // 表示设置成功
            },
            deleteProperty(target, property) {
                if (property in target) {
                    const oldValue = target[property];
                    delete target[property];
                    callback(target, property, oldValue, undefined);
                }
                return true; // 表示删除成功
            }
        });
    } else if (['string', 'number', 'boolean'].includes(typeof value)) {
        // 基本类型
        let internalValue = value;
        return {
            get value() {
                return internalValue;
            },
            set value(newValue) {
                if (internalValue !== newValue) {
                    const oldValue = internalValue;
                    internalValue = newValue;
                    callback(window, 'value', oldValue, newValue);
                }
            }
        };
    } else {
        throw new Error('Unsupported data type for watching');
    }
}

/*
    // 示例
    // 监听对象
    let myObject = { a: 1, b: 2 };
    let proxyObject = watchVariable(myObject, (target, key, oldVal, newVal) => {
        console.log(`Object property ${key} changed from ${oldVal} to ${newVal}`);
    });
    proxyObject.a = 10; // 输出: Object property a changed from 1 to 10
    delete proxyObject.b; // 输出: Object property b changed from 2 to undefined

    // 监听数组
    let myArray = [1, 2, 3];
    let proxyArray = watchVariable(myArray, (target, key, oldVal, newVal) => {
        console.log(`Array index ${key} changed from ${oldVal} to ${newVal}`);
    });
    proxyArray[0] = 100; // 输出: Array index 0 changed from 1 to 100

    // 监听字符串
    let myString = 'hello';
    let watchedString = watchVariable(myString, (target, key, oldVal, newVal) => {
        console.log(`String changed from ${oldVal} to ${newVal}`);
    });
    watchedString.value = 'world'; // 输出: String changed from hello to world

    // 监听数字
    let myNumber = 42;
    let watchedNumber = watchVariable(myNumber, (target, key, oldVal, newVal) => {
        console.log(`Number changed from ${oldVal} to ${newVal}`);
    });
    watchedNumber.value = 100; // 输出: Number changed from 42 to 100

    // 监听布尔值
    let myBoolean = true;
    let watchedBoolean = watchVariable(myBoolean, (target, key, oldVal, newVal) => {
        console.log(`Boolean changed from ${oldVal} to ${newVal}`);
    });
    watchedBoolean.value = false; // 输出: Boolean changed from true to false
*/

function getDeviceIcon (deviceInfo) {
	let src = 'icon_device0.svg',
		product_name = deviceInfo.product_name || deviceInfo.metadata.product_name;
	if (product_name.indexOf('2204') > -1 || product_name.indexOf('2200') > -1 || product_name.indexOf('2201') > -1) {
		src = 'logo_2204.png';
	}
	if (product_name.indexOf('2102') > -1 || product_name.indexOf('2110') > -1 || product_name.indexOf('2112') > -1) {
		src = 'logo_2102.png';
	}
	if (product_name.indexOf('3302') > -1) {
		src = 'icon_device3.svg';
	}
	if (product_name.indexOf('2001') > -1 || product_name.indexOf('2011') > -1) {
		src = 'icon_device4.svg';
	}
	if (product_name.indexOf('3401') > -1 || product_name.indexOf('2401') > -1) {
		src = 'icon_device5.svg';
	}
	if (product_name.indexOf('3602') > -1 || product_name.indexOf('9823') > -1) {
		src = 'logo_3602.png';
	}
	return src;
};

// 获取文件后缀名
function getFileExtension(filename) {
    // 使用 split 方法将文件名按 '.' 分割成数组
    const parts = filename.split('.');
    // 返回数组的最后一个元素，并转换为小写
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function showAlert(type, message) {
    const toastPlacement = document.getElementById('toastPlacement');
    const toast = new bootstrap.Toast(toastPlacement);
    $('#toastPlacement').removeClass(function(index, className) {
        return (className.match(/(^|\s)text-bg-\S+/g) || []).join(' ');
    }).addClass(`text-bg-${type}`);;
    const toastContent = $('#toastContent');
    toastContent.html(message);
    toast.show();
}

function showConfirmModal(content, confirmCallback, cancelCallback) {
    const confirmModal = new bootstrap.Modal(document.getElementById("confirmModal"));
    if (content) {
        $('#confirmModalContent').html(content);
    }
    // 绑定删除按钮的点击事件
    $('#confirmModalConfirmBtn').off('click').on('click', function() {
        if (confirmCallback && typeof confirmCallback === 'function') {
            confirmCallback();
        }
        confirmModal.hide();
    });
    $('#confirmModalCancelBtn').on('click', function() {
        if (cancelCallback && typeof cancelCallback === 'function') {
            cancelCallback();
        }
        confirmModal.hide();
    });
    confirmModal.show();
}

// 匹配最后一个下划线
function splitStringByLastUnderscore(str) {
    const regex = /_(?!.*_)/; 
    return str.split(regex);
}

// 跳转至登录页
function redirectToLogin() {
    const url = '/ui/login';
    if (window.self !== window.top) {
        // 当前窗口在 iframe 中
        window.parent.location.href = url;
    } else {
        // 当前窗口不在 iframe 中
        window.location.href = url;
    }
}

// 竖向range滑动条联动指示数字
function updateVerticalRangeValue(range) {
    const valueDiv = range.previousElementSibling;
    valueDiv.textContent = range.value;
}

//设置rangeInput的value值时，改变其背景色
function updateRangeBackground(rangeInput) {
    const value = (rangeInput.value - rangeInput.min) / (rangeInput.max - rangeInput.min) * 100;
    rangeInput.style.setProperty('--value', `${value}%`);
}

//formatMilliseconds 函数并传入毫秒值，就可以得到 mm:ss 格式的字符串。
function formatMilliseconds(ms) {
    // 计算总秒数
    const totalSeconds = Math.floor(ms / 1000);
    
    // 计算分钟和秒
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // 确保分钟和秒都是两位数
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    // 返回格式化后的字符串
    return `${formattedMinutes}:${formattedSeconds}`;
}
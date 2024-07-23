// Copyright (c) Abstract Machines
// SPDX-License-Identifier: Apache-2.0

import { displayErrorMessage, removeErrorMessage } from "./errors.js";

const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
const phoneRegex = /^1[3-9]\d{9}$/; //手机号码正则
const minLength = 8;

function validateNoSpaces(inputString) {
    // 使用正则表达式匹配任何包含空格的字符串
    // 如果匹配到空格，则返回true；否则返回false
    return /\s/.test(inputString);
}

function validateName(name, errorDiv, fieldName, event) {
    removeErrorMessage(errorDiv, fieldName);
    if (name.trim() === "") {
        event.preventDefault();
        displayErrorMessage("名称是必填项", errorDiv, fieldName);
        return false;
    }
    return true;
}

function validateID(id, errorDiv, fieldName, event) {
    removeErrorMessage(errorDiv, fieldName);
    if (id.trim() === "") {
        event.preventDefault();
        displayErrorMessage("ID是必填项", errorDiv, fieldName);
        return false;
    } else if (validateNoSpaces(id)) {
        event.preventDefault();
        displayErrorMessage("ID不能含有空格", errorDiv, fieldName);
        return false;
    }
    return true;
}

function validateEmail(email, errorDiv, fieldName, event) {
    removeErrorMessage(errorDiv, fieldName);
    if (email.trim() === "") {
        event.preventDefault();
        displayErrorMessage("Email是必填项", errorDiv, fieldName);
        return false;
    } else if (!email.match(emailRegex)) {
        event.preventDefault();
        displayErrorMessage("Email格式错误", errorDiv, fieldName);
        return false;
    }
    return true;
}

function validateEmailOrPhone(emailOrPhone, errorDiv, fieldName, event) {
    removeErrorMessage(errorDiv, fieldName);
    if (emailOrPhone.trim() === "") {
        event.preventDefault();
        displayErrorMessage("Email或者电话号码是必填项", errorDiv, fieldName);
        return false;
    } else if (!(emailOrPhone.match(emailRegex) || emailOrPhone.match(phoneRegex))) {
        event.preventDefault();
        displayErrorMessage("Email或者电话号码格式错误", errorDiv, fieldName);
        return false;
    }
    return true;
}

function validatePassword(password, errorDiv, fieldName, event) {
    removeErrorMessage(errorDiv, fieldName);
    if (password.trim().length < minLength) {
        event.preventDefault();
        const errorMessage = `密码长度至少为${minLength}个字符`;
        displayErrorMessage(errorMessage, errorDiv, fieldName);
        return false;
    }
    return true;
}

function validateJSON(data, errorDiv, fieldName, event) {
    removeErrorMessage(errorDiv, fieldName);
    try {
        if (data.trim() !== "") {
            JSON.parse(data);
        }
    } catch (error) {
        event.preventDefault();
        displayErrorMessage("JSON数据格式错误", errorDiv, fieldName);
        return false;
    }
    return true;
}

function validateStringArray(tags, errorDiv, fieldName, event) {
    removeErrorMessage(errorDiv, fieldName);
    let tagsArray;
    try {
        if (tags.trim() !== "") {
            tagsArray = JSON.parse(tags);
        }
        if (
            !Array.isArray(tagsArray) ||
            !tagsArray.every(function (tag) {
                return typeof tag === "string";
            })
        ) {
            event.preventDefault();
            displayErrorMessage("必须是字符串数组", errorDiv, fieldName);
            return false;
        }
    } catch (error) {
        event.preventDefault();
        displayErrorMessage("必须是字符串数组", errorDiv, fieldName);
        return false;
    }

    return true;
}

function validateFloat(value, errorDiv, fieldName, event) {
    removeErrorMessage(errorDiv, fieldName);
    if (value.trim() === "") {
        event.preventDefault();
        displayErrorMessage("值为必填项", errorDiv, fieldName);
        return false;
    }

    const floatValue = parseFloat(value);
    if (isNaN(floatValue)) {
        event.preventDefault();
        displayErrorMessage("必须是数字", errorDiv, fieldName);
        return false;
    }
    return true;
}

function attachValidationListener(config) {
    const button = document.getElementById(config.buttonId);

    button.addEventListener("click", function (event) {
        for (const key in config.validations) {
            if (config.validations.hasOwnProperty(key)) {
                const validationFunc = config.validations[key];
                const elementValue = document.getElementById(key).value;
                validationFunc(elementValue, config.errorDivs[key], config.fields[key], event);
            }
        }
    });
}

export { 
	validateName, 
	validateID, 
	validateEmail, 
	validateEmailOrPhone, 
	validatePassword, 
	validateJSON, 
	validateStringArray, 
	validateFloat, 
	attachValidationListener 
};

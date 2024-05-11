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
    displayErrorMessage("Name is Required", errorDiv, fieldName);
    return false;
  }
  return true;
}

function validateID(id, errorDiv, fieldName, event) {
  removeErrorMessage(errorDiv, fieldName);
  if (id.trim() === "") {
    event.preventDefault();
    displayErrorMessage("ID is Required", errorDiv, fieldName);
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
    displayErrorMessage("Email is Required", errorDiv, fieldName);
    return false;
  } else if (!email.match(emailRegex)) {
    event.preventDefault();
    displayErrorMessage("Invalid email format", errorDiv, fieldName);
    return false;
  }
  return true;
}

function validateEmailOrPhone(emailOrPhone, errorDiv, fieldName, event) {
  removeErrorMessage(errorDiv, fieldName);
  if (emailOrPhone.trim() === "") {
    event.preventDefault();
    displayErrorMessage("Email or phone number is Required", errorDiv, fieldName);
    return false;
  } else if (!(emailOrPhone.match(emailRegex) || emailOrPhone.match(phoneRegex))) {
    event.preventDefault();
    displayErrorMessage("Invalid email or phone number format", errorDiv, fieldName);
    return false;
  }
  return true;
}

function validatePassword(password, errorDiv, fieldName, event) {
  removeErrorMessage(errorDiv, fieldName);
  if (password.trim().length < minLength) {
    event.preventDefault();
    var errorMessage = `Password must be at least ${minLength} characters long`;
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
    displayErrorMessage("not a valid JSON object", errorDiv, fieldName);
    return false;
  }
  return true;
}

function validateStringArray(tags, errorDiv, fieldName, event) {
  removeErrorMessage(errorDiv, fieldName);
  var tagsArray;
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
      displayErrorMessage("must be strings in an array", errorDiv, fieldName);
      return false;
    }
  } catch (error) {
    event.preventDefault();
    displayErrorMessage("must be a string array", errorDiv, fieldName);
    return false;
  }

  return true;
}

function validateFloat(value, errorDiv, fieldName, event) {
  removeErrorMessage(errorDiv, fieldName);
  if (value.trim() === "") {
    event.preventDefault();
    displayErrorMessage("Value is required", errorDiv, fieldName);
    return false;
  }

  const floatValue = parseFloat(value);
  if (isNaN(floatValue)) {
    event.preventDefault();
    displayErrorMessage("must be a number", errorDiv, fieldName);
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
  attachValidationListener,
};

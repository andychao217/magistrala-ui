// Copyright (c) Abstract Machines
// SPDX-License-Identifier: Apache-2.0

// getCookie retrieves a cookie by name from the browser cookies.
function getCookie(name) {
    const nameEQ = name + "=";
    let cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i];
        while (cookie.charAt(0) == " ") {
            cookie = cookie.substring(1, cookie.length);
        }
        if (cookie.indexOf(nameEQ) == 0) {
            return cookie.substring(nameEQ.length, cookie.length);
        }
    }
    return null;
}

function clearAllCookies() {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        document.cookie = cookies[i] + "=; expires=" + new Date(0).toUTCString();
    }
}

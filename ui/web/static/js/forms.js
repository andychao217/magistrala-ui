// Copyright (c) Abstract Machines
// SPDX-License-Identifier: Apache-2.0

// config parameters are: formId, url, alertDiv, modal
export function submitCreateForm(config) {
    const form = document.getElementById(config.formId);
    let url = config.url;
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        let formData = new FormData(form);
        if(config.type === "addThing"){
            formData.delete("metadata");
            formData.append("metadata", `{"is_online": "0"}`);
        } else if (config.type === "addThing" || config.type === "addChannel" || config.type === "addGroup" || config.type === "addUser" ) {
            formData.delete("metadata");
            formData.append("metadata", `{}`);
        }

        if (config.formId === "userform") {
            //密码加密
            const password = formData.get("password");
            const encryptedData = encryptByAesCbc(password, SECRET_KEY);
            formData.delete("password");
            formData.append("password", encryptedData);
        }

        let fetchConfig = {
            method: "POST",
            body: formData,
        }

        if (config.type.includes('edit')) {
            url += `/${formData.get("id")}`;
            let queryData = {};
            // 遍历 FormData 对象
            for (let pair of formData.entries()) {
                // pair 是一个包含键和值的数组 [key, value]
                queryData[pair[0]] = pair[1];
            }
            fetchConfig = {
                method: "POST",
                body: JSON.stringify(queryData),
                headers: {
                    "Content-Type": "application/json",
                }
            }
        }

        fetch(url, fetchConfig)
            .then(function (response) {
                if (!response.ok) {
                    const errorMessage = response.headers.get("X-Error-Message");
                    if (errorMessage) {
                        showAlert("danger", errorMessage);
                    } else {
                        showAlert("danger", `Error: ${response.status}`);
                    }
                } else {
                    form.reset();
                    config.modal.hide();
                    window.location.reload();
                }
            })
            .catch((error) => {
                console.error("error submitting form: ", error);
                showAlert("danger", `错误: ${error}`);
            });
    });
}


export function submitUpdateForm(config) {
    const queryData = config.data;
    fetch(config.url, {
        method: "POST",
        body: JSON.stringify(queryData),
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((response) => {
            if (!response.ok) {
                const errorMessage = response.headers.get("X-Error-Message");
                if (errorMessage) {
                    if (config.field) {
                        showAlert("danger", errorMessage + ": " + config.field);
                    } else {
                        showAlert("danger", errorMessage);
                    }
                } else {
                    showAlert("danger", `Error: ${response.status}`);
                }
            } else {
                window.location.reload();
            }
        })
        .catch((error) => {
            console.error("error submitting form: ", error);
            showAlert("danger", `Error: ${error}`);
        });
}

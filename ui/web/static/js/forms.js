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
            let data = {};
            // 遍历 FormData 对象
            for (let pair of formData.entries()) {
                // pair 是一个包含键和值的数组 [key, value]
                data[pair[0]] = pair[1];
            }
            fetchConfig = {
                method: "POST",
                body: JSON.stringify(data),
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
                        showError(errorMessage, config.alertDiv);
                    } else {
                        showError(`Error: ${response.status}`, config.alertDiv);
                    }
                } else {
                    form.reset();
                    config.modal.hide();
                    window.location.reload();
                }
            })
            .catch((error) => {
                console.error("error submitting form: ", error);
                showError(`错误: ${error}`, config.alertDiv);
            });
    });
}


export function submitUpdateForm(config) {
    fetch(config.url, {
        method: "POST",
        body: JSON.stringify(config.data),
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((response) => {
            if (!response.ok) {
                const errorMessage = response.headers.get("X-Error-Message");
                if (errorMessage) {
                    if (config.field) {
                        showError(errorMessage + ": " + config.field, config.alertDiv);
                    } else {
                        showError(errorMessage, config.alertDiv);
                    }
                } else {
                    showError(`Error: ${response.status}`, config.alertDiv);
                }
            } else {
                window.location.reload();
            }
        })
        .catch((error) => {
            console.error("error submitting form: ", error);
            showError(`错误: ${error}`, config.alertDiv);
        });
}

export function showError(errorMessage, alertDiv) {
    const alert = document.getElementById(alertDiv);
    alert.innerHTML = `
	<div class="alert alert-danger alert-dismissable fade show d-flex flex-row justify-content-between" role="alert">
	  <div>${errorMessage}</div>
	  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="close"></button>
	</div> `;
}

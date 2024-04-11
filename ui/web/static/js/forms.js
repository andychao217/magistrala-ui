// Copyright (c) Abstract Machines
// SPDX-License-Identifier: Apache-2.0

// config parameters are: formId, url, alertDiv, modal
export function submitCreateForm(config) {
  const form = document.getElementById(config.formId);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(form);
    
    fetch(config.url, {
      method: "POST",
      body: formData,
    })
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
        showError(`error submitting form: ${error}`, config.alertDiv);
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
      showError(`error submitting form: ${error}`, config.alertDiv);
    });
}

function showError(errorMessage, alertDiv) {
  const alert = document.getElementById(alertDiv);
  alert.innerHTML = `
	<div class="alert alert-danger alert-dismissable fade show d-flex flex-row justify-content-between" role="alert">
	  <div>${errorMessage}</div>
	  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="close"></button>
	</div> `;
}

//默认新增一个通道
export function createDefaultChannel (url) {
  let formData = new FormData();
  formData.append("name", "Default Channel");
  formData.append("description", "");
  formData.append("metadata", JSON.stringify({}));
  fetch(url, {
    method: "POST",
    body: formData,
  })
    .then(function (response) {
      if (!response.ok) {
        const errorMessage = response.headers.get("X-Error-Message");
        if (errorMessage) {
          console.log("error submitting form: ", errorMessage);
        } else {
          console.log(`Error: ${response.status}`);
        }
      } else {
        console.log("createDefaultChannel sucess ");
        console.log('response',response)
        window.location.reload();
      }
    })
    .catch((error) => {
      console.log("error submitting form: ", error);
    });
}
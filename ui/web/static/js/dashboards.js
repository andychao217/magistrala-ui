// Copyright (c) Abstract Machines
// SPDX-License-Identifier: Apache-2.0

const newDashboard = () => {
    const modal = new bootstrap.Modal(document.getElementById("createDashboardModal"));
    modal.show();
};

const createDashboardForm = document.getElementById("create-dashboard-form");
createDashboardForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const queryData = {
        name: createDashboardForm.name.value,
        description: createDashboardForm.description.value,
    };
    fetch(`${pathPrefix}/dashboards`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(queryData),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.dashboard) {
                appendAlert(
                    `Dashboard ${data.dashboard.name} with id ${data.dashboard.id}  created successfully`,
                    "success",
                );
                setTimeout(() => {
                    window.location.href = `/dashboards/${data.dashboard.id}`;
                }, 1000);
            } else {
                appendAlert("创建统计面板失败", "danger");
            }
        })
        .catch((error) => console.error("Error:", error));
});

// Infinite scroll code start
const cardsRow = document.getElementById("dashboard-cards-container");
const cardCountElem = document.getElementById("cards-count");
const cardTotalElem = document.getElementById("cards-total");
let currentPage = 1;
let limit = 30;
let total, pageCount;

const addCards = (pageIndex) => {
    setTimeout(() => {
        currentPage = pageIndex;
        fetch(`${pathPrefix}/dashboards/list?page=${pageIndex}&limit=${limit}`, {
            method: "GET",
        })
            .then((response) => response.json())
            .then((data) => {
                total = data.total;
                cardTotalElem.innerHTML = total;
                limit = data.limit;
                pageCount = data.pages;
                if (currentPage === pageCount) {
                    document.getElementById("dashboard-loader").remove();
                }
                if (data.dashboards) {
                    createCard(data);
                    const endRange = currentPage == pageCount ? total : pageIndex * limit;
                    cardCountElem.innerHTML = endRange;
                } else {
                    document.getElementById("dashboard-loader").remove();
                    cardCountElem.innerHTML = 0;
                    const newDiv = document.createElement("div");
                    newDiv.innerHTML = `
						<div class="col-12 text-center">
							<h5>没有统计面板</h5>
						</div>
					`;
                    cardsRow.appendChild(newDiv);
                }
            })
            .catch((error) => console.error("Error:", error));
    }, 500);
};

window.onload = () => {
    addCards(currentPage);
};

const handleInfiniteScroll = () => {
    let { clientHeight, scrollHeight, scrollTop } = document.documentElement;
    if (clientHeight + scrollTop + 1 >= scrollHeight) {
        addCards(currentPage + 1);
    }
    if (currentPage === pageCount) {
        removeInfiniteScroll();
    }
};

window.addEventListener("scroll", handleInfiniteScroll);

const removeInfiniteScroll = () => {
    window.removeEventListener("scroll", handleInfiniteScroll);
};

// Infinite scroll code end

// Create card creates a new card for each dashboard.
function createCard(data) {
    data.dashboards.forEach((dashboard) => {
        const newDiv = document.createElement("div");
        newDiv.className = "col-12 col-md-6 col-lg-4 mb-3";
        newDiv.innerHTML = `
			<div class="card">
				<a href="${pathPrefix}/dashboards/${dashboard.id}" class="card-link">
					<div class="card-header text-center">
						<h5 class="card-title">${dashboard.name}</h5>
						<h6 class="text-muted fs-6 dashboard-card-id">${dashboard.id}</h6>
					</div>
					<div class="card-body dashboard-card-body">
						<p class="card-text dashboard-card-description">
							${dashboard.description}
						</p>
					</div>
				</a>
				<div class="card-footer buttons">
					<button type="button" class="btn me-2" onclick="deleteDashboard('${dashboard.id}')">
						<i class="fa-solid fa-trash-can"></i>
					</button>
					<button
						type="button"
						class="btn me-2"
						onclick="editDashboard('${dashboard.id}', '${dashboard.name}', '${dashboard.description}')"
					>
						<i class="fas fa-edit"></i>
					</button>
				</div>
			</div>
        `;
        cardsRow.appendChild(newDiv);
    });
}

// Delete dashboard deletes the dashboard from the database.
function deleteDashboard(id) {
    const queryData = {id: id};
    fetch(`${pathPrefix}/dashboards`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(queryData),
    })
        .then((response) => {
            if (response.status === 204) {
                appendAlert("统计面板删除成功", "success");
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                appendAlert("统计面板删除失败", "danger");
            }
        })
        .catch((error) => console.error("Error:", error));
}

// Append alert  adds an alert to the UI page.
const appendAlert = (message, type) => {
    const alertDiv = document.getElementById("dashboard-alert");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = [
        `<div class="alert alert-${type} alert-dismissible p-3" role="alert">`,
        `   <div>${message}</div>`,
        `   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`,
        "</div>",
    ].join("");
    alertDiv.appendChild(wrapper);
};

const updateDashboardModal = new bootstrap.Modal(document.getElementById("updateDashboardModal"));
function editDashboard(id, name, description) {
    const form = document.getElementById("update-dashboard-form");
    form.name.value = name;
    form.description.value = description;
    form.id.value = id;

    updateDashboardModal.show();
}

const updateButton = document.getElementById("update-dashboard-button");
updateButton.addEventListener("click", function () {
    const form = document.getElementById("update-dashboard-form");
    const queryData = {
        id: form.id.value,
        name: form.name.value,
        description: form.description.value,
    };
    fetch(`${pathPrefix}/dashboards`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(queryData),
    })
        .then((response) => {
            if (response.status === 200) {
                updateDashboardModal.hide();
                appendAlert("统计面板修改成功", "success");
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                updateDashboardModal.hide();
                appendAlert("统计面板修改失败", "danger");
            }
        })
        .catch((error) => console.error("Error:", error));
});

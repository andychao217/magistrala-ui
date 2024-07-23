// Copyright (c) Abstract Machines
// SPDX-License-Identifier: Apache-2.0

export function fetchIndividualEntity(config) {
    if (config.item === "members") {
        config.permission = "member";
    } else {
        config.permission = "";
    }
    document.addEventListener("DOMContentLoaded", function () {
        getEntities(config, "");
        infiniteScroll(config);
    });

    const input = document.getElementById(config.input);

    input.addEventListener("input", function (event) {
        const itemSelect = document.getElementById(config.itemSelect);
        if (event.target.value === "") {
            itemSelect.innerHTML = `<option disabled>请选择</option>`;
            getEntities(config, "");
            infiniteScroll(config);
        } else {
            itemSelect.innerHTML = "";
            getEntities(config, event.target.value);
        }
    });
}

function getEntities(config, name) {
    fetchData({
        item: config.item,
        domain: config.domain,
        permission: config.permission,
        itemSelect: config.itemSelect,
        name: name,
        page: 1,
        pathPrefix: config.pathPrefix,
    });
}

function infiniteScroll(config) {
    const selectElement = document.getElementById(config.itemSelect);
    const singleOptionHeight = selectElement.querySelector("option").offsetHeight;
    const selectBoxHeight = selectElement.offsetHeight;
    const numOptionsBeforeLoad = 2;
    let lastScrollTop = 0;
    let currentPageNo = 1;
    let currentScroll = 0;

    selectElement.addEventListener("scroll", function () {
        const st = selectElement.scrollTop;
        const totalHeight = selectElement.querySelectorAll("option").length * singleOptionHeight;

        if (st > lastScrollTop) {
            currentScroll = st + selectBoxHeight;
            if (currentScroll + numOptionsBeforeLoad * singleOptionHeight >= totalHeight) {
                currentPageNo++;
                fetchData({
                    item: config.item,
                    itemSelect: config.itemSelect,
                    name: "",
                    domain: config.domain,
                    permission: config.permission,
                    page: currentPageNo,
                    pathPrefix: config.pathPrefix,
                });
            }
        }

        lastScrollTop = st;
    });
}

let limit = 5;
function fetchData(config) {
    fetch(
        `${config.pathPrefix}/entities?item=${config.item}&limit=${limit}&name=${config.name}&page=${config.page}&domain=${config.domain}&permission=${config.permission}`,
        {
            method: "GET",
        },
    ).then((response) => response.json())
	.then((data) => {
		const selectElement = document.getElementById(config.itemSelect);
		data.data.forEach((entity) => {
			const option = document.createElement("option");
			option.value = entity.id;
			option.text = entity.name;
			selectElement.appendChild(option);
		});
	})
	.catch((error) => console.error("Error:", error));
}

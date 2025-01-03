# Copyright (c) Abstract Machines
# SPDX-License-Identifier: Apache-2.0

MG_DOCKER_IMAGE_ALIYUN_PREFIX ?= registry.cn-hangzhou.aliyuncs.com
MG_DOCKER_IMAGE_USERNAME_PREFIX ?= andychao217
MG_DOCKER_IMAGE_NAME_PREFIX ?= magistrala
SVC = ui
BUILD_DIR = build
CGO_ENABLED ?= 0
GOOS ?= linux
GOARCH ?= arm64
VERSION ?= $(shell git describe --abbrev=0 --tags || echo "none")
COMMIT ?= $(shell git rev-parse HEAD)
TIME ?= $(shell date +%F_%T)
MOCKERY_VERSION=v2.42.0

define compile_service
	CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=$(GOARCH) GOARM=$(GOARM) \
	go build -ldflags "-s -w \
	-X 'github.com/andychao217/magistrala.BuildTime=$(TIME)' \
	-X 'github.com/andychao217/magistrala.Version=$(VERSION)' \
	-X 'github.com/andychao217/magistrala.Commit=$(COMMIT)'" \
	-o ${BUILD_DIR}/$(SVC) cmd/$(SVC)/main.go
endef

define make_docker
	docker buildx build --platform=linux/amd64,linux/arm64 \
		--no-cache \
		--build-arg SVC=$(SVC) \
		--build-arg VERSION=$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg TIME=$(TIME) \
		--tag=$(MG_DOCKER_IMAGE_USERNAME_PREFIX)/$(MG_DOCKER_IMAGE_NAME_PREFIX)-$(SVC) \
		--tag=$(MG_DOCKER_IMAGE_ALIYUN_PREFIX)/$(MG_DOCKER_IMAGE_USERNAME_PREFIX)/$(MG_DOCKER_IMAGE_NAME_PREFIX)-$(SVC) \
		-f docker/Dockerfile .
endef

define make_docker_dev
	docker build \
		--no-cache \
		--build-arg SVC=$(SVC) \
		--tag=$(MG_DOCKER_IMAGE_USERNAME_PREFIX)/$(MG_DOCKER_IMAGE_NAME_PREFIX)-$(svc) \
		-f docker/Dockerfile.dev .
endef

all: ui

.PHONY: ui docker docker_dev run_docker run

clean:
	rm -rf ${BUILD_DIR}

cleandocker:
	# Stops containers and removes containers, networks, volumes, and images created by up
	docker compose -f docker/docker-compose.yml --env-file docker/.env down -v

install:
	cp ${BUILD_DIR}/$(SVC) $(GOBIN)/magistrala-${SVC}

mocks:
	@which mockery > /dev/null || go install github.com/vektra/mockery/v2@$(MOCKERY_VERSION)
	@unset MOCKERY_VERSION && go generate ./...

test:
	go test -v -race -count 1 -tags test -coverprofile=coverage.out $(shell go list ./... | grep -v 'cmd')

lint:
	golangci-lint run --config .golangci.yml
	npx prettier --config .prettierrc --plugin prettier-plugin-go-template --check .

$(SVC):
	$(call compile_service)

docker:
	$(call make_docker)

docker_dev:
	$(call make_docker_dev)

define docker_push
	docker push ${MG_DOCKER_IMAGE_ALIYUN_PREFIX}/$(MG_DOCKER_IMAGE_USERNAME_PREFIX)/$(MG_DOCKER_IMAGE_NAME_PREFIX)-$(SVC):$(1)
	docker push $(MG_DOCKER_IMAGE_USERNAME_PREFIX)/$(MG_DOCKER_IMAGE_NAME_PREFIX)-$(SVC):$(1)
endef

latest: docker
	$(call docker_push,latest)

run_docker:
	docker compose -f docker/docker-compose.yml --env-file docker/.env up

run:
	${BUILD_DIR}/$(SVC)

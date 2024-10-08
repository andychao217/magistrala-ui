// Code generated by mockery v2.42.0. DO NOT EDIT.

// Copyright (c) Abstract Machines

package mocks

import (
	context "context"

	ui "github.com/andychao217/magistrala-ui/ui"
	mock "github.com/stretchr/testify/mock"
)

// DashboardRepository is an autogenerated mock type for the DashboardRepository type
type DashboardRepository struct {
	mock.Mock
}

// Create provides a mock function with given fields: ctx, dashboard
func (_m *DashboardRepository) Create(ctx context.Context, dashboard ui.Dashboard) (ui.Dashboard, error) {
	ret := _m.Called(ctx, dashboard)

	if len(ret) == 0 {
		panic("no return value specified for Create")
	}

	var r0 ui.Dashboard
	var r1 error
	if rf, ok := ret.Get(0).(func(context.Context, ui.Dashboard) (ui.Dashboard, error)); ok {
		return rf(ctx, dashboard)
	}
	if rf, ok := ret.Get(0).(func(context.Context, ui.Dashboard) ui.Dashboard); ok {
		r0 = rf(ctx, dashboard)
	} else {
		r0 = ret.Get(0).(ui.Dashboard)
	}

	if rf, ok := ret.Get(1).(func(context.Context, ui.Dashboard) error); ok {
		r1 = rf(ctx, dashboard)
	} else {
		r1 = ret.Error(1)
	}

	return r0, r1
}

// Delete provides a mock function with given fields: ctx, dashboardID, userID
func (_m *DashboardRepository) Delete(ctx context.Context, dashboardID string, userID string) error {
	ret := _m.Called(ctx, dashboardID, userID)

	if len(ret) == 0 {
		panic("no return value specified for Delete")
	}

	var r0 error
	if rf, ok := ret.Get(0).(func(context.Context, string, string) error); ok {
		r0 = rf(ctx, dashboardID, userID)
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

// Retrieve provides a mock function with given fields: ctx, dashboardID, userID
func (_m *DashboardRepository) Retrieve(ctx context.Context, dashboardID string, userID string) (ui.Dashboard, error) {
	ret := _m.Called(ctx, dashboardID, userID)

	if len(ret) == 0 {
		panic("no return value specified for Retrieve")
	}

	var r0 ui.Dashboard
	var r1 error
	if rf, ok := ret.Get(0).(func(context.Context, string, string) (ui.Dashboard, error)); ok {
		return rf(ctx, dashboardID, userID)
	}
	if rf, ok := ret.Get(0).(func(context.Context, string, string) ui.Dashboard); ok {
		r0 = rf(ctx, dashboardID, userID)
	} else {
		r0 = ret.Get(0).(ui.Dashboard)
	}

	if rf, ok := ret.Get(1).(func(context.Context, string, string) error); ok {
		r1 = rf(ctx, dashboardID, userID)
	} else {
		r1 = ret.Error(1)
	}

	return r0, r1
}

// RetrieveAll provides a mock function with given fields: ctx, page
func (_m *DashboardRepository) RetrieveAll(ctx context.Context, page ui.DashboardPageMeta) (ui.DashboardPage, error) {
	ret := _m.Called(ctx, page)

	if len(ret) == 0 {
		panic("no return value specified for RetrieveAll")
	}

	var r0 ui.DashboardPage
	var r1 error
	if rf, ok := ret.Get(0).(func(context.Context, ui.DashboardPageMeta) (ui.DashboardPage, error)); ok {
		return rf(ctx, page)
	}
	if rf, ok := ret.Get(0).(func(context.Context, ui.DashboardPageMeta) ui.DashboardPage); ok {
		r0 = rf(ctx, page)
	} else {
		r0 = ret.Get(0).(ui.DashboardPage)
	}

	if rf, ok := ret.Get(1).(func(context.Context, ui.DashboardPageMeta) error); ok {
		r1 = rf(ctx, page)
	} else {
		r1 = ret.Error(1)
	}

	return r0, r1
}

// Update provides a mock function with given fields: ctx, dashboardID, userID, dr
func (_m *DashboardRepository) Update(ctx context.Context, dashboardID string, userID string, dr ui.DashboardReq) error {
	ret := _m.Called(ctx, dashboardID, userID, dr)

	if len(ret) == 0 {
		panic("no return value specified for Update")
	}

	var r0 error
	if rf, ok := ret.Get(0).(func(context.Context, string, string, ui.DashboardReq) error); ok {
		r0 = rf(ctx, dashboardID, userID, dr)
	} else {
		r0 = ret.Error(0)
	}

	return r0
}

// NewDashboardRepository creates a new instance of DashboardRepository. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
// The first argument is typically a *testing.T value.
func NewDashboardRepository(t interface {
	mock.TestingT
	Cleanup(func())
}) *DashboardRepository {
	mock := &DashboardRepository{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}

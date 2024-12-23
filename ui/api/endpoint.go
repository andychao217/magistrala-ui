// Copyright (c) Abstract Machines
// SPDX-License-Identifier: Apache-2.0

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/andychao217/magistrala-ui/ui"
	"github.com/andychao217/magistrala/pkg/errors"
	"github.com/go-kit/kit/endpoint"
	"github.com/golang-jwt/jwt"
	"github.com/gorilla/securecookie"
	"golang.org/x/sync/errgroup"
)

func indexEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(indexReq)
		if err := req.validate(); err != nil {
			return nil, err
		}
		res, err := svc.Index(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func viewRegistrationEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, _ interface{}) (interface{}, error) {
		res, err := svc.ViewRegistration()
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func registerUserEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(registerUserReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		token, err := svc.RegisterUser(req.User)
		if err != nil {
			return nil, err
		}

		accessExp, err := extractTokenExpiry(token.AccessToken)
		if err != nil {
			return nil, err
		}
		refreshExp, err := extractTokenExpiry(token.RefreshToken)
		if err != nil {
			return nil, err
		}

		tkr := uiRes{
			code: http.StatusOK,
			cookies: []*http.Cookie{
				{
					Name:     accessTokenKey,
					Value:    token.AccessToken,
					Path:     "/",
					HttpOnly: false,
					Expires:  accessExp,
				},
				{
					Name:     refreshTokenKey,
					Value:    token.RefreshToken,
					Path:     "/",
					HttpOnly: false,
					Expires:  refreshExp,
				},
			},
		}
		return tkr, nil
	}
}

func loginEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, _ interface{}) (interface{}, error) {
		res, err := svc.Login()
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func logoutEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, _ interface{}) (interface{}, error) {
		if err := svc.Logout(); err != nil {
			return nil, err
		}

		cookies := []*http.Cookie{
			{
				Name:   sessionDetailsKey,
				Value:  "",
				Path:   "/",
				MaxAge: -1,
			},
			{
				Name:   refreshTokenKey,
				Value:  "",
				Path:   fmt.Sprintf("%s/%s/login", prefix, domainsAPIEndpoint),
				MaxAge: -1,
			},
			{
				Name:   refreshTokenKey,
				Value:  "",
				Path:   fmt.Sprintf("%s/%s", prefix, tokenRefreshAPIEndpoint),
				MaxAge: -1,
			},
		}
		return uiRes{
			code:    http.StatusOK,
			cookies: cookies,
		}, nil
	}
}

func passwordResetRequestEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(passwordResetRequestReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.PasswordResetRequest(req.email); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, loginAPIEndpoint)},
		}, nil
	}
}

func passwordResetEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(passwordResetReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.PasswordReset(req.token, req.password, req.confirmPassword); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, loginAPIEndpoint)},
		}, nil
	}
}

func showPasswordResetEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, _ interface{}) (interface{}, error) {
		res, err := svc.ShowPasswordReset()
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func showUpdatePasswordEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(showUpdatePasswordReq)

		res, err := svc.PasswordUpdate(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func updatePasswordEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateUserPasswordReq)

		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdatePassword(req.token, req.oldPass, req.newPass); err != nil {
			return nil, err
		}

		cookies := []*http.Cookie{
			{
				Name:   sessionDetailsKey,
				Value:  "",
				Path:   "/",
				MaxAge: -1,
			},
			{
				Name:   refreshTokenKey,
				Value:  "",
				Path:   fmt.Sprintf("%s/%s/login", prefix, domainsAPIEndpoint),
				MaxAge: -1,
			},
			{
				Name:   refreshTokenKey,
				Value:  "",
				Path:   fmt.Sprintf("%s/%s", prefix, tokenRefreshAPIEndpoint),
				MaxAge: -1,
			},
		}

		return uiRes{
			code:    http.StatusSeeOther,
			cookies: cookies,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, loginAPIEndpoint)},
		}, nil
	}
}

func tokenEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(tokenReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		token, err := svc.Token(req.Login)
		if err != nil {
			return nil, err
		}

		accessExp, err := extractTokenExpiry(token.AccessToken)
		if err != nil {
			return nil, err
		}
		refreshExp, err := extractTokenExpiry(token.RefreshToken)
		if err != nil {
			return nil, err
		}

		tkr := uiRes{
			code: http.StatusOK,
			cookies: []*http.Cookie{
				{
					Name:     accessTokenKey,
					Value:    token.AccessToken,
					Path:     "/",
					HttpOnly: false,
					Expires:  accessExp,
				},
				{
					Name:     refreshTokenKey,
					Value:    token.RefreshToken,
					Path:     "/",
					HttpOnly: false,
					Expires:  refreshExp,
				},
			},
		}

		return tkr, nil
	}
}

func secureTokenEndpoint(svc ui.Service, s *securecookie.SecureCookie, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(secureTokenReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		sessionReq := ui.Session{
			Token:       req.AccessToken,
			LoginStatus: ui.UserLoginStatus,
		}

		sessionDetails, err := svc.Session(sessionReq)
		if err != nil {
			return nil, err
		}
		sessionDetails.Token = req.AccessToken
		session, err := json.Marshal(sessionDetails)
		if err != nil {
			return nil, errors.Wrap(ui.ErrJSONMarshal, err)
		}
		secureSessionDetails, err := s.Encode(sessionDetailsKey, string(session))
		if err != nil {
			return nil, errors.Wrap(errCookieEncrypt, err)
		}

		secureRefreshToken, err := s.Encode(refreshTokenKey, req.RefreshToken)
		if err != nil {
			return nil, errors.Wrap(errCookieEncrypt, err)
		}

		refreshExp, err := extractTokenExpiry(req.RefreshToken)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusSeeOther,
			cookies: []*http.Cookie{
				{
					Name:     sessionDetailsKey,
					Value:    secureSessionDetails,
					Path:     "/",
					HttpOnly: false,
				},
				{
					Name:     refreshTokenKey,
					Value:    secureRefreshToken,
					Path:     fmt.Sprintf("%s/%s", prefix, tokenRefreshAPIEndpoint),
					Expires:  refreshExp,
					HttpOnly: false,
				},
				{
					Name:     refreshTokenKey,
					Value:    secureRefreshToken,
					Path:     fmt.Sprintf("%s/%s/login", prefix, domainsAPIEndpoint),
					Expires:  refreshExp,
					HttpOnly: false,
				},
				{
					Name:   accessTokenKey,
					Value:  "",
					Path:   "/",
					MaxAge: -1,
				},
				{
					Name:   refreshTokenKey,
					Value:  "",
					Path:   "/",
					MaxAge: -1,
				},
			},
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, domainsAPIEndpoint)},
		}, nil
	}
}

func refreshTokenEndpoint(svc ui.Service, s *securecookie.SecureCookie, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(refreshTokenReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		token, err := svc.RefreshToken(req.Token)
		if err != nil {
			return nil, err
		}

		req.Session.Token = token.AccessToken
		session, err := json.Marshal(req.Session)
		if err != nil {
			return nil, errors.Wrap(ui.ErrJSONMarshal, err)
		}
		secureSessionDetails, err := s.Encode(sessionDetailsKey, string(session))
		if err != nil {
			return nil, errors.Wrap(errCookieEncrypt, err)
		}

		secureRefreshToken, err := s.Encode(refreshTokenKey, token.RefreshToken)
		if err != nil {
			return nil, errors.Wrap(errCookieEncrypt, err)
		}
		refreshExp, err := extractTokenExpiry(token.RefreshToken)
		if err != nil {
			return nil, err
		}

		tkr := uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": req.ref},
			cookies: []*http.Cookie{
				{
					Name:     sessionDetailsKey,
					Value:    secureSessionDetails,
					Path:     "/",
					HttpOnly: false,
				},
				{
					Name:     refreshTokenKey,
					Value:    secureRefreshToken,
					Path:     fmt.Sprintf("%s/%s", prefix, tokenRefreshAPIEndpoint),
					Expires:  refreshExp,
					HttpOnly: false,
				},
				{
					Name:     refreshTokenKey,
					Value:    secureRefreshToken,
					Path:     fmt.Sprintf("%s/%s/login", prefix, domainsAPIEndpoint),
					Expires:  refreshExp,
					HttpOnly: false,
				},
			},
		}

		return tkr, nil
	}
}

func createUserEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(createUserReq)

		if err := req.validate(); err != nil {
			return nil, err
		}
		if err := svc.CreateUsers(req.token, req.User); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusCreated,
		}, nil
	}
}

func createUsersEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(createUsersReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.CreateUsers(req.token, req.users...); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusCreated,
		}, nil
	}
}

func profileUserEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(profileUserReq)

		jsonData, _ := json.Marshal(req)
		fmt.Println("profileUserReq: ", jsonData)

		if err := req.validate(); err != nil {
			fmt.Println("profileUser validate: ", err)
			return nil, err
		}

		user, err := svc.ProfileUser(req.Session)
		if err != nil {
			fmt.Println("profileUser profile: ", err)
			return nil, err
		}

		// 创建一个map，其中包含一个User实例
		data := map[string]interface{}{
			"user": user,
		}

		// 将map编码为JSON字符串
		jsonData, err = json.Marshal(data)
		if err != nil {
			fmt.Println("profileUser Marshal: ", err)
			return nil, err
		}

		return jsonResponse{
			Data: string(jsonData),
		}, nil
	}
}

func listUsersEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListUsers(req.Session, req.status, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func viewUserEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(viewResourceReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ViewUser(req.Session, req.id)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func updateUserEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateUserReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateUser(req.token, req.User); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func updateUserTagsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateUserTagsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateUserTags(req.token, req.User); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func updateUserIdentityEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateUserIdentityReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateUserIdentity(req.token, req.User); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func updateUserRoleEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateUserRoleReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateUserRole(req.token, req.User); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s", prefix, usersAPIEndpoint, req.ID)},
		}, nil
	}
}

func enableUserEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateUserStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.EnableUser(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, usersAPIEndpoint)},
		}, nil
	}
}

func disableUserEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateUserStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DisableUser(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, usersAPIEndpoint)},
		}, nil
	}
}

func deleteUserEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(deleteUserReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DeleteUser(req.token, req.id); err != nil {
			return nil, err
		}

		return jsonResponse{
			Data: "Delete Success",
		}, nil
	}
}

func AddMemberToChannelEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(addUserToChannelReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.AddUserToChannel(req.token, req.ChannelID, req.UsersRelationRequest); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, channelsAPIEndpoint, req.ChannelID, usersAPIEndpoint)},
		}, nil
	}
}

func RemoveMemberFromChannelEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(addUserToChannelReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.RemoveUserFromChannel(req.token, req.ChannelID, req.UsersRelationRequest); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, channelsAPIEndpoint, req.ChannelID, usersAPIEndpoint)},
		}, nil
	}
}

func assignGroupEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(assignReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.Assign(req.token, req.groupID, req.UsersRelationRequest); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, groupsAPIEndpoint, req.groupID, usersAPIEndpoint)},
		}, nil
	}
}

func unassignGroupEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(assignReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.Unassign(req.token, req.groupID, req.UsersRelationRequest); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, groupsAPIEndpoint, req.groupID, usersAPIEndpoint)},
		}, nil
	}
}

func createThingEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(createThingReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.CreateThing(req.Thing, req.token); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusCreated,
		}, nil
	}
}

func createThingsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(createThingsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.CreateThings(req.token, req.things...); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusCreated,
		}, nil
	}
}

func listThingsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListThings(req.Session, req.status, req.page, req.limit, req.onlineStatus, req.showFullData)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

// 以json形式查询thingsList
func listThingsDataEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListThingsInJSON(req.Session, req.status, req.page, req.limit, req.onlineStatus, req.showFullData)
		if err != nil {
			fmt.Println("get things data 123: ", err)
			return nil, err
		}

		data := map[string]interface{}{
			"thingsData": res,
		}

		// 将map编码为JSON字符串
		jsonData, err := json.Marshal(data)
		if err != nil {
			fmt.Println("thingsData Marshal 123: ", err)
			return nil, err
		}

		return jsonResponse{
			Data: string(jsonData),
		}, nil
	}
}

func viewThingEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(viewResourceReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ViewThing(req.Session, req.id)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func deleteClientEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(deleteClientOrChannelReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DeleteClient(req.token, req.id); err != nil {
			return nil, err
		}

		return jsonResponse{
			Data: "Delete Success",
		}, nil
	}
}

func updateThingEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateThingReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateThing(req.token, req.Thing); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func updateThingTagsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateThingTagsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateThingTags(req.token, req.Thing); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func updateThingSecretEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateThingSecretReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateThingSecret(req.token, req.Thing); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func enableThingEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateThingStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.EnableThing(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, thingsAPIEndpoint)},
		}, nil
	}
}

func disableThingEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateThingStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DisableThing(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, thingsAPIEndpoint)},
		}, nil
	}
}

func listThingMembersEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(listEntityByIDReq)

		res, err := svc.ListThingUsers(req.Session, req.id, req.relation, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			html: res,
			code: http.StatusOK,
		}, nil
	}
}

func listChannelsByThingEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityByIDReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListChannelsByThing(req.Session, req.id, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listChannelsByThingInJSONEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityByIDReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListChannelsByThingInJSON(req.Session, req.id, req.page, req.limit)
		if err != nil {
			fmt.Println("get listChannelsByThingInJSON 123: ", err)
			return nil, err
		}

		data := map[string]interface{}{
			"channelsData": res,
		}

		// 将map编码为JSON字符串
		jsonData, err := json.Marshal(data)
		if err != nil {
			fmt.Println("listChannelsByThingInJSON Marshal 123: ", err)
			return nil, err
		}

		return jsonResponse{
			Data: string(jsonData),
		}, nil
	}
}

func connectChannelEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(connectThingReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.ConnectThing(req.thingID, req.channelID, req.token); err != nil {
			return nil, err
		}

		var ret uiRes

		switch req.item {
		case thingsItem:
			ret = uiRes{
				code:    http.StatusSeeOther,
				headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, thingsAPIEndpoint, req.thingID, channelsAPIEndpoint)},
			}
		case channelsItem:
			ret = uiRes{
				code:    http.StatusSeeOther,
				headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, channelsAPIEndpoint, req.channelID, thingsAPIEndpoint)},
			}
		}

		return ret, nil
	}
}

func connectChannelAndThingsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(connectChannelAndThingsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.ConnectThing(req.thingID, req.channelID, req.token); err != nil {
			return nil, err
		}

		return jsonResponse{
			Data: "Connect Success",
		}, nil
	}
}

func disconnectChannelAndThingsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(connectChannelAndThingsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DisconnectThing(req.thingID, req.channelID, req.token); err != nil {
			return nil, err
		}

		return jsonResponse{
			Data: "Disconnect Success",
		}, nil
	}
}

func disconnectChannelEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(connectThingReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DisconnectThing(req.thingID, req.channelID, req.token); err != nil {
			return nil, err
		}

		var ret uiRes

		switch req.item {
		case thingsItem:
			ret = uiRes{
				code:    http.StatusSeeOther,
				headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, thingsAPIEndpoint, req.thingID, channelsAPIEndpoint)},
			}
		case channelsItem:
			ret = uiRes{
				code:    http.StatusSeeOther,
				headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, channelsAPIEndpoint, req.channelID, thingsAPIEndpoint)},
			}
		}

		return ret, nil
	}
}

func createChannelEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(createChannelReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.CreateChannel(req.Channel, req.token); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusCreated,
		}, nil
	}
}

func createChannelsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(createChannelsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.CreateChannels(req.token, req.Channels...); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusCreated,
		}, nil
	}
}

func listChannelsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListChannels(req.Session, req.status, req.page, req.limit)
		if err != nil {
			return nil, err
		}
		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listChannelsInJSONEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListChannelsInJSON(req.Session, req.status, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		data := map[string]interface{}{
			"channelsData": res,
		}

		// 将map编码为JSON字符串
		jsonData, err := json.Marshal(data)
		if err != nil {
			fmt.Println("channelsData Marshal 123: ", err)
			return nil, err
		}

		return jsonResponse{
			Data: string(jsonData),
		}, nil
	}
}

func viewChannelEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(viewResourceReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ViewChannel(req.Session, req.id)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func updateChannelEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateChannelReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateChannel(req.token, req.Channel); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func listThingsByChannelEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityByIDReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListThingsByChannel(req.Session, req.id, req.page, req.limit, req.onlineStatus)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listThingsByChannelInJSONEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityByIDReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListThingsByChannelInJSON(req.Session, req.id, req.page, req.limit, req.onlineStatus)
		if err != nil {
			fmt.Println("get listThingsByChannelInJSONEndpoint 123: ", err)
			return nil, err
		}

		data := map[string]interface{}{
			"thingsData": res,
		}

		// 将map编码为JSON字符串
		jsonData, err := json.Marshal(data)
		if err != nil {
			fmt.Println("listThingsByChannelInJSONEndpoint Marshal 123: ", err)
			return nil, err
		}

		return jsonResponse{
			Data: string(jsonData),
		}, nil
	}
}

func enableChannelEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateChannelStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.EnableChannel(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, channelsAPIEndpoint)},
		}, nil
	}
}

func disableChannelEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateChannelStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DisableChannel(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, channelsAPIEndpoint)},
		}, nil
	}
}

func ListChannelMembersEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(listEntityByIDReq)

		res, err := svc.ListChannelUsers(req.Session, req.id, req.relation, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			html: res,
			code: http.StatusOK,
		}, nil
	}
}

func addGroupToChannelEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(addUserGroupToChannelReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.AddUserGroupToChannel(req.token, req.channelID, req.UserGroupsRequest); err != nil {
			return nil, err
		}

		var ret uiRes

		switch req.item {
		case groupsItem:
			ret = uiRes{
				code:    http.StatusSeeOther,
				headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, groupsAPIEndpoint, req.UserGroupIDs[0], channelsAPIEndpoint)},
			}
		case channelsItem:
			ret = uiRes{
				code:    http.StatusSeeOther,
				headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, channelsAPIEndpoint, req.channelID, groupsAPIEndpoint)},
			}
		}

		return ret, nil
	}
}

func removeGroupFromChannelEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(addUserGroupToChannelReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.RemoveUserGroupFromChannel(req.token, req.channelID, req.UserGroupsRequest); err != nil {
			return nil, err
		}

		var ret uiRes

		switch req.item {
		case groupsItem:
			ret = uiRes{
				code:    http.StatusSeeOther,
				headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, groupsAPIEndpoint, req.UserGroupIDs[0], channelsAPIEndpoint)},
			}
		case channelsItem:
			ret = uiRes{
				code:    http.StatusSeeOther,
				headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, channelsAPIEndpoint, req.channelID, groupsAPIEndpoint)},
			}
		}

		return ret, nil
	}
}

func ListChannelGroupsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(listEntityByIDReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListChannelUserGroups(req.Session, req.id, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			html: res,
			code: http.StatusOK,
		}, nil
	}
}

// PostMessages to the channels
func postMessageEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(postMessageReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.PostMessage(req.ChannelID, req.Message, req.ThingSecret); err != nil {
			return nil, err
		}

		return jsonResponse{
			Data: "Post message success",
		}, nil
	}
}

func deleteChannelEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(deleteClientOrChannelReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DeleteChannel(req.token, req.id); err != nil {
			fmt.Println("deleteChannelEndpoint 123: ", err)
			return nil, err
		}

		return jsonResponse{
			Data: "Delete Success",
		}, nil
	}
}

func createGroupEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		cgr := request.(createGroupReq)
		if err := cgr.validate(); err != nil {
			return nil, err
		}

		if err := svc.CreateGroups(cgr.token, cgr.Group); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusCreated,
		}, nil
	}
}

func createGroupsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(createGroupsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.CreateGroups(req.token, req.Groups...); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusCreated,
		}, nil
	}
}

func listGroupMembersEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityByIDReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListGroupUsers(req.Session, req.id, req.relation, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func viewGroupEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(viewResourceReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ViewGroup(req.Session, req.id)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func updateGroupEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateGroupReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateGroup(req.token, req.Group); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func listGroupsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListGroups(req.Session, req.status, req.page, req.limit)
		if err != nil {
			return nil, err
		}
		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func enableGroupEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateGroupStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.EnableGroup(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, groupsAPIEndpoint)},
		}, nil
	}
}

func disableGroupEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateGroupStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DisableGroup(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, groupsAPIEndpoint)},
		}, nil
	}
}

func listGroupChannelsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(listEntityByIDReq)

		res, err := svc.ListUserGroupChannels(req.Session, req.id, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			html: res,
			code: http.StatusOK,
		}, nil
	}
}

func publishMessageEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(publishReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.Publish(req.channelID, req.thingKey, req.Message); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/messages?thing=%s&channel=%s", prefix, req.thingKey, req.channelID)},
		}, nil
	}
}

func readMessagesEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(readMessagesReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ReadMessages(req.Session, req.channelID, req.thingKey, req.mpgm)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func readMessagesInJSONEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(readMessagesReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ReadMessagesInJSON(req.Session, req.channelID, req.thingKey, req.mpgm)
		if err != nil {
			return nil, err
		}

		// 创建一个map，其中包含一个User实例
		data := map[string]interface{}{
			"messagesData": res,
		}

		// 将map编码为JSON字符串
		jsonData, err := json.Marshal(data)
		fmt.Println("messages: ", jsonData)
		if err != nil {
			fmt.Println("read messages Marshal: ", err)
			return nil, err
		}

		return jsonResponse{
			Data: string(jsonData),
		}, nil
	}
}

func FetchChartDataEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(readMessagesReq)
		if err := req.validate(); err != nil {
			return nil, err
		}
		res, err := svc.FetchChartData(req.Session.Token, req.channelID, req.mpgm)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusOK,
			html:    res,
			headers: map[string]string{"Content-Type": jsonContentType},
		}, nil
	}
}

func createBootstrap(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(createBootstrapReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.CreateBootstrap(req.token, req.BootstrapConfig); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, bootstrapAPIEndpoint)},
		}, nil
	}
}

func listBootstrap(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(listEntityReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListBootstrap(req.Session, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func updateBootstrap(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(updateBootstrapReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateBootstrap(req.token, req.BootstrapConfig); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func deleteBootstrapEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(deleteBootstrapReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DeleteBootstrap(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, bootstrapAPIEndpoint)},
		}, nil
	}
}

func updateBootstrapStateEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(updateBootstrapStateReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateBootstrapState(req.token, req.BootstrapConfig); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s", prefix, bootstrapAPIEndpoint, req.ThingID)},
		}, nil
	}
}

func updateBootstrapConnections(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(updateBootstrapConnReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateBootstrapConnections(req.token, req.BootstrapConfig); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s", prefix, bootstrapAPIEndpoint, req.ThingID)},
		}, nil
	}
}

func updateBootstrapCerts(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(updateBootstrapCertReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateBootstrapCerts(req.token, req.BootstrapConfig); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func viewBootstrap(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(viewResourceReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ViewBootstrap(req.Session, req.id)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func getTerminalEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(viewResourceReq)
		if err := req.validate(); err != nil {
			return nil, err
		}
		res, err := svc.GetRemoteTerminal(req.Session, req.id)
		if err != nil {
			return nil, err
		}

		return uiRes{
			html: res,
		}, nil
	}
}

func handleTerminalInputEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(ctx context.Context, request interface{}) (response interface{}, err error) {
		req := request.(bootstrapCommandReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		// Create a channel to receive the command result
		ch := make(chan string)

		g, ctx := errgroup.WithContext(ctx)

		// Start a goroutine to process the command asynchronously
		g.Go(func() error {
			return svc.ProcessTerminalCommand(ctx, req.id, req.token, req.command, ch)
		})

		if err := g.Wait(); err != nil {
			return nil, err
		}

		// Receive the command result from the channel
		result := <-ch

		return terminalResponse{
			Command: req.command,
			Result:  result,
		}, nil
	}
}

func getEntitiesEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(getEntitiesReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.GetEntities(req.token, req.item, req.name, req.domainID, req.permission, req.page, req.limit)
		if err != nil {
			return nil, err
		}
		return uiRes{
			html:    res,
			code:    http.StatusOK,
			headers: map[string]string{"Content-Type": jsonContentType},
		}, nil
	}
}

func errorPageEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (response interface{}, err error) {
		req := request.(errorReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ErrorPage(req.err, req.pageURL)
		if err != nil {
			return nil, err
		}
		return uiRes{
			html: res,
			code: http.StatusOK,
		}, nil
	}
}

func domainLoginEndpoint(svc ui.Service, s *securecookie.SecureCookie, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(domainLoginReq)
		if err := req.validate(); err != nil {
			return nil, err
		}
		token, err := svc.DomainLogin(req.Login, req.Token)
		if err != nil {
			return nil, err
		}
		req.Domain.ID = req.DomainID
		req.Token = token.AccessToken
		sessionDetails, err := svc.Session(req.Session)
		if err != nil {
			return nil, err
		}

		sessionDetails.Token = token.AccessToken
		session, err := json.Marshal(sessionDetails)
		if err != nil {
			return nil, errors.Wrap(ui.ErrJSONMarshal, err)
		}
		secureSessionDetails, err := s.Encode(sessionDetailsKey, string(session))
		if err != nil {
			return nil, errors.Wrap(errCookieEncrypt, err)
		}

		secureRefreshToken, err := s.Encode(refreshTokenKey, token.RefreshToken)
		if err != nil {
			return nil, errors.Wrap(errCookieEncrypt, err)
		}

		refreshExp, err := extractTokenExpiry(token.RefreshToken)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusSeeOther,
			cookies: []*http.Cookie{
				{
					Name:     sessionDetailsKey,
					Value:    secureSessionDetails,
					Path:     "/",
					HttpOnly: false,
				},
				{
					Name:     refreshTokenKey,
					Value:    secureRefreshToken,
					Path:     fmt.Sprintf("%s/%s", prefix, tokenRefreshAPIEndpoint),
					Expires:  refreshExp,
					HttpOnly: false,
				},
				{
					Name:     refreshTokenKey,
					Value:    secureRefreshToken,
					Path:     fmt.Sprintf("%s/%s/login", prefix, domainsAPIEndpoint),
					Expires:  refreshExp,
					HttpOnly: false,
				},
			},
			headers: map[string]string{"Location": fmt.Sprintf("%s/?domain=%s", prefix, req.DomainID)},
		}, nil
	}
}

func listDomainsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listDomainsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListDomains(req.Session, req.status, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func createDomainEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(createDomainReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.CreateDomain(req.token, req.Domain); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, domainsAPIEndpoint)},
		}, nil
	}
}

func updateDomainEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateDomainReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateDomain(req.token, req.Domain); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func updateDomainTagsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateDomainTagsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UpdateDomain(req.token, req.Domain); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func domainEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityByIDReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.Domain(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func domainInJSONEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityByIDReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.DomainInJSON(req.Session)
		if err != nil {
			return nil, err
		}

		data := map[string]interface{}{
			"domainData": res,
		}

		// 将map编码为JSON字符串
		jsonData, err := json.Marshal(data)
		if err != nil {
			fmt.Println("domainData Marshal 123: ", err)
			return nil, err
		}

		return jsonResponse{
			Data: string(jsonData),
		}, nil
	}
}

func enableDomainEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateDomainStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.EnableDomain(req.token, req.id); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, domainsAPIEndpoint)},
		}, nil
	}
}

func disableDomainEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(updateDomainStatusReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DisableDomain(req.token, req.id); err != nil {
			return nil, err
		}

		cookies := []*http.Cookie{
			{
				Name:   sessionDetailsKey,
				Value:  "",
				Path:   "/",
				MaxAge: -1,
			},
			{
				Name:   refreshTokenKey,
				Value:  "",
				Path:   fmt.Sprintf("%s/%s", prefix, tokenRefreshAPIEndpoint),
				MaxAge: -1,
			},
			{
				Name:   refreshTokenKey,
				Value:  "",
				Path:   fmt.Sprintf("%s/%s/login", prefix, domainsAPIEndpoint),
				MaxAge: -1,
			},
		}

		return uiRes{
			code:    http.StatusSeeOther,
			cookies: cookies,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, loginAPIEndpoint)},
		}, nil
	}
}

func assignMemberEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(assignMemberReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.AssignMember(req.token, req.domainID, req.UsersRelationRequest); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/members", prefix, domainsAPIEndpoint, req.domainID)},
		}, nil
	}
}

func unassignMemberEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(assignMemberReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UnassignMember(req.token, req.domainID, req.UsersRelationRequest); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/members", prefix, domainsAPIEndpoint, req.domainID)},
		}, nil
	}
}

func viewMemberEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(viewMemberReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ViewMember(req.Session, req.userIdentity)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listMembersEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listEntityByIDReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.Members(req.Session, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func shareThingEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(shareThingReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.ShareThing(req.token, req.id, req.UsersRelationRequest); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, thingsAPIEndpoint, req.id, usersAPIEndpoint)},
		}, nil
	}
}

func unshareThingEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(shareThingReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.UnshareThing(req.token, req.id, req.UsersRelationRequest); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/%s", prefix, thingsAPIEndpoint, req.id, usersAPIEndpoint)},
		}, nil
	}
}

func sendInvitationEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(sendInvitationReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.SendInvitation(req.token, req.Invitation); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func listInvitationsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(listInvitationsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.Invitations(req.Session, req.domainID, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func acceptInvitationEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(acceptInvitationReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.AcceptInvitation(req.token, req.domainID); err != nil {
			return nil, err
		}

		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s", prefix, domainsAPIEndpoint)},
		}, nil
	}
}

func deleteInvitationEndpoint(svc ui.Service, prefix string) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(deleteInvitationReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DeleteInvitation(req.token, req.userID, req.domainID); err != nil {
			return nil, err
		}

		if req.domain == "" {
			return uiRes{
				code:    http.StatusSeeOther,
				headers: map[string]string{"Location": fmt.Sprintf("%s/invitations", prefix)},
			}, nil
		}
		return uiRes{
			code:    http.StatusSeeOther,
			headers: map[string]string{"Location": fmt.Sprintf("%s/%s/%s/invitations", prefix, domainsAPIEndpoint, req.domainID)},
		}, nil
	}
}

func listNxtDashboardEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(nxtDashboardReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.NxtDashboard(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listBlankEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(blankReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.Blank(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listFileEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(fileReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.File(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listFirmwareEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(firmwareReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.Firmware(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listDeviceUpgradeEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(deviceUpgradeReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.DeviceUpgrade(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listBroadcastEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(broadcastReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.Broadcast(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func listTaskEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(taskReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.Task(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func viewDashboardEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(ctx context.Context, request interface{}) (interface{}, error) {
		req := request.(viewDashboardReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ViewDashboard(ctx, req.Session, req.DashboardID)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func createDashboardEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(ctx context.Context, request interface{}) (interface{}, error) {
		req := request.(createDashboardReq)
		if err := req.validate(); err != nil {
			return nil, err
		}
		dr := ui.DashboardReq{
			Name:        req.Name,
			Description: req.Description,
			Layout:      req.Layout,
		}

		res, err := svc.CreateDashboard(ctx, req.token, dr)
		if err != nil {
			return nil, err
		}
		return uiRes{
			code:    http.StatusCreated,
			html:    res,
			headers: map[string]string{"Content-Type": jsonContentType},
		}, nil
	}
}

func listDashboardsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(ctx context.Context, request interface{}) (interface{}, error) {
		req := request.(listDashboardsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.ListDashboards(ctx, req.token, req.page, req.limit)
		if err != nil {
			return nil, err
		}

		return uiRes{
			html:    res,
			code:    http.StatusOK,
			headers: map[string]string{"Content-Type": jsonContentType},
		}, nil
	}
}

func dashboardsEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(_ context.Context, request interface{}) (interface{}, error) {
		req := request.(dashboardsReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		res, err := svc.Dashboards(req.Session)
		if err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
			html: res,
		}, nil
	}
}

func updateDashboardEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(ctx context.Context, request interface{}) (interface{}, error) {
		req := request.(updateDashboardReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		d := ui.DashboardReq{
			Name:        req.Name,
			Description: req.Description,
			Layout:      req.Layout,
			Metadata:    req.Metadata,
		}
		if err := svc.UpdateDashboard(ctx, req.token, req.ID, d); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusOK,
		}, nil
	}
}

func deleteDashboardEndpoint(svc ui.Service) endpoint.Endpoint {
	return func(ctx context.Context, request interface{}) (interface{}, error) {
		req := request.(deleteDashboardReq)
		if err := req.validate(); err != nil {
			return nil, err
		}

		if err := svc.DeleteDashboard(ctx, req.token, req.ID); err != nil {
			return nil, err
		}

		return uiRes{
			code: http.StatusNoContent,
		}, nil
	}
}

func extractTokenExpiry(token string) (time.Time, error) {
	jwtToken, _, err := new(jwt.Parser).ParseUnverified(token, jwt.MapClaims{})
	if err != nil {
		return time.Time{}, errors.Wrap(errParseToken, err)
	}
	var expTime time.Time
	if claims, ok := jwtToken.Claims.(jwt.MapClaims); ok {
		expUnix := int64(claims["exp"].(float64))
		expTime = time.Unix(expUnix, 0)
	}
	return expTime, nil
}

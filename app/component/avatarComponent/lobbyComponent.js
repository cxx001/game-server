/**
 * Date: 2019/2/14
 * Author: admin
 * Description:
 */
let pomelo = require('pomelo');
let Component = require('../component');
let util = require('util');
let consts = require('../../common/consts');
let messageService = require('../../services/messageService');
var dispatcher = require('../../util/dispatcher');

let LobbyComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(LobbyComponent, Component);
module.exports = LobbyComponent;

let pro = LobbyComponent.prototype;

pro.init = function (opts) {
};

pro.createRoom = function(roomCfg, next) {
	let self = this;
	let usrInfo = self.entity.clientLoginInfo();

	// 获取远程游戏服id
	let recordRoomId = usrInfo.roomid;
	pomelo.app.rpc.centerGlobal.centerRemote.getRoomId2Sid(null, recordRoomId, function (sid) {
		let toServerId = sid;
		if (!toServerId) {
			// TODO: 临时处理, 后期优化实时的负载均衡
			let tables = pomelo.app.getServersByType('table');
			let res = dispatcher.dispatch(usrInfo.id, tables);
			toServerId = res.id;
		};

		// 远程调用创房
		let preSid = self.entity.serverId;
		pomelo.app.rpc.table.privateRemote.createRoom.toServer(toServerId, preSid, usrInfo, roomCfg, function (resp) {
			next(null, resp);
			self._enterRoomCtr(usrInfo.id, resp.roomInfo, toServerId);
		});
	});
};

pro.joinRoom = function (roomid, next) {
	let self = this;
	let usrInfo = self.entity.clientLoginInfo();
	// 获取远程游戏服id
	let recordRoomId = usrInfo.roomid;
	pomelo.app.rpc.centerGlobal.centerRemote.getRoomId2SidEx(null, recordRoomId, roomid, function (roomid, toServerId) {
		if (!toServerId) {
			next(null, {code: consts.RoomCode.NO_EXIST_ROOM});
			return;
		}
	
		// 远程调用创房
		let preSid = self.entity.serverId;
		pomelo.app.rpc.table.privateRemote.joinRoom.toServer(toServerId, preSid, usrInfo, roomid, function (resp) {
			next(null, resp);
			self._enterRoomCtr(usrInfo.id, resp.roomInfo, toServerId);
		});
	});
};

pro._enterRoomCtr = function (uid, roomInfo, toServerId) {
	if (!roomInfo) {
		return;
	}

	// 更新房间ID
	this.entity.updateUserRoomId(roomInfo.roomid);
	
	// 向其它人推送玩家加入信息
	for (let i = 0; i < roomInfo.players.length; i++) {
		const user = roomInfo.players[i];
		if (uid == user.id) {
			this._notifyJoinRoomToOtherMem(uid, roomInfo.players, 'onUserEntryRoom', user);
			break;
		}
	};

	// 绑定远程服务器id,供rpc路由
	this.entity.setSessionSetting("tableID", roomInfo.roomid);
    this.entity.setSessionSetting("tableServer", toServerId);
    this.entity.importSessionSetting();
};

pro._notifyJoinRoomToOtherMem = function (uid, players, route, msg) {
	var uids = [];
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		if (user.id === uid)
            continue
        uids.push({uid: user.id, sid: this.entity.serverId});
	}
    if (uids.length) {
        messageService.pushMessageByUids(uids, route, msg);
    }
};

/* *************************  match begin  ************************* */

// 获取金币场游戏大厅信息
pro.getMatchInfo = function (gameType, next) {
	pomelo.app.rpc.matchGlobal.matchRemote.getMatchInfo(null, gameType, function (resp) {
		next(null, resp);
	});
};

// 进入金币场
pro.startMatch = function (gameType, stage, next) {
	let usrInfo = this.entity.clientLoginInfo();
	usrInfo.preSid = this.entity.serverId;
	pomelo.app.rpc.matchGlobal.matchRemote.startMatch(null, gameType, stage, usrInfo, function (resp) {
		next(null, resp);
	});
};
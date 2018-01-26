/**
 * Informational Commands
 * Pokemon Showdown - https://pokemonshowdown.com/
 *
 * These are informatissonal commands. For instance, you can define the command
 * 'whois' here, sthen use it by typing /whois into Pokemon Showdown.
 *
 * For the API, see chat-plugins/COMMANDS.md
 *
 * @license MIT license
 */

'use strict';

exports.commands = {

	'!whois': true,
	ip: 'whois',
	rooms: 'whois',
	alt: 'whois',
	alts: 'whois',
	whoare: 'whois',
	whois: function (target, room, user, connection, cmd) {
		if (room && room.id === 'staff' && !this.runBroadcast()) return;
		if (!room) room = Rooms.global;
		let targetUser = this.targetUserOrSelf(target, user.group === ' ');
		let showAll = (cmd === 'ip' || cmd === 'whoare' || cmd === 'alt' || cmd === 'alts');
		if (!targetUser) {
			if (showAll) return this.parse('/offlinewhois ' + target);
			return this.errorReply("User " + this.targetUsername + " not found.");
		}
		if (showAll && !user.trusted && targetUser !== user) {
			return this.errorReply(`/${cmd} - Access denied.`);
		}

		let buf = Chat.html`<strong class="username"><small style="display:none">${targetUser.group}</small>${targetUser.name}</strong> `;
		const ac = targetUser.autoconfirmed;
		if (ac && showAll) buf += ` <small style="color:gray">(ac${targetUser.userid === ac ? `` : `: ${ac}`})</small>`;
		if (!targetUser.connected) buf += ` <em style="color:gray">(offline)</em>`;
		let roomauth = '';
		if (room.auth && targetUser.userid in room.auth) roomauth = room.auth[targetUser.userid];
		if (Config.groups[roomauth] && Config.groups[roomauth].name) {
			buf += `<br />${Config.groups[roomauth].name} (${roomauth})`;
		}
		if (Config.groups[targetUser.group] && Config.groups[targetUser.group].name) {
			buf += `<br />Global ${Config.groups[targetUser.group].name} (${targetUser.group})`;
		}
		if (targetUser.isSysop) {
			buf += `<br />(Pok&eacute;mon Showdown System Operator)`;
		}
		if (!targetUser.registered) {
			buf += `<br />(Unregistered)`;
		}
		let publicrooms = "";
		let hiddenrooms = "";
		let privaterooms = "";
		for (const roomid of targetUser.inRooms) {
			if (roomid === 'global') continue;
			let targetRoom = Rooms.get(roomid);

			let authSymbol = (targetRoom.auth && targetRoom.auth[targetUser.userid] ? targetRoom.auth[targetUser.userid] : '');
			let battleTitle = (roomid.battle ? ` title="${roomid.title}"` : '');
			let output = `${authSymbol}<a href="/${roomid}"${battleTitle}>${roomid}</a>`;
			if (targetRoom.isPrivate === true) {
				if (targetRoom.modjoin === '~') continue;
				if (privaterooms) privaterooms += " | ";
				privaterooms += output;
			} else if (targetRoom.isPrivate) {
				if (hiddenrooms) hiddenrooms += " | ";
				hiddenrooms += output;
			} else {
				if (publicrooms) publicrooms += " | ";
				publicrooms += output;
			}
		}
		buf += '<br />Rooms: ' + (publicrooms || '<em>(no public rooms)</em>');

		if (!showAll) {
			return this.sendReplyBox(buf);
		}
		buf += '<br />';
		if (user.can('alts', targetUser) || user.can('alts') && user === targetUser) {
			let prevNames = Object.keys(targetUser.prevNames).join(", ");
			if (prevNames) buf += Chat.html`<br />Previous names: ${prevNames}`;

			for (const targetAlt of targetUser.getAltUsers(true)) {
				if (!targetAlt.named && !targetAlt.connected) continue;
				if (targetAlt.group === '~' && user.group !== '~') continue;

				buf += Chat.html`<br />Alt: <span class="username">${targetAlt.name}</span>`;
				if (!targetAlt.connected) buf += ` <em style="color:gray">(offline)</em>`;
				prevNames = Object.keys(targetAlt.prevNames).join(", ");
				if (prevNames) buf += `<br />Previous names: ${prevNames}`;
			}
			if (targetUser.namelocked) {
				buf += `<br />NAMELOCKED: ${targetUser.namelocked}`;
				let punishment = Punishments.userids.get(targetUser.locked);
				if (punishment) {
					let expiresIn = Punishments.checkLockExpiration(targetUser.locked);
					if (expiresIn) buf += expiresIn;
					if (punishment[3]) buf += Chat.html` (reason: ${punishment[3]})`;
				}
			} else if (targetUser.locked) {
				buf += `<br />LOCKED: ${targetUser.locked}`;
				switch (targetUser.locked) {
				case '#dnsbl':
					buf += ` - IP is in a DNS-based blacklist`;
					break;
				case '#range':
					buf += ` - IP or host is in a temporary range-lock`;
					break;
				case '#hostfilter':
					buf += ` - host is permanently locked for being a proxy`;
					break;
				}
				let punishment = Punishments.userids.get(targetUser.locked);
				if (punishment) {
					let expiresIn = Punishments.checkLockExpiration(targetUser.locked);
					if (expiresIn) buf += expiresIn;
					if (punishment[3]) buf += Chat.html` (reason: ${punishment[3]})`;
				}
			}
			if (targetUser.semilocked) {
				buf += `<br />Semilocked: ${targetUser.semilocked}`;
			}
		}
		if ((user.can('ip', targetUser) || user === targetUser)) {
			let ips = Object.keys(targetUser.ips);
			ips = ips.map(ip => {
				let status = [];
				let punishment = Punishments.ips.get(ip);
				if (user.can('ip') && punishment) {
					let [punishType, userid] = punishment;
					let punishMsg = Punishments.punishmentTypes.get(punishType) || 'punished';
					if (userid !== targetUser.userid) punishMsg += ` as ${userid}`;
					status.push(punishMsg);
				}
				if (Punishments.sharedIps.has(ip)) {
					let sharedStr = 'shared';
					if (Punishments.sharedIps.get(ip)) {
						sharedStr += `: ${Punishments.sharedIps.get(ip)}`;
					}
					status.push(sharedStr);
				}
				return ip + (status.length ? ` (${status.join('; ')})` : '');
			});
			buf += `<br /> IP${Chat.plural(ips)}: ${ips.join(", ")}`;
			if (user.group !== ' ' && targetUser.latestHost) {
				buf += Chat.html`<br />Host: ${targetUser.latestHost}`;
			}
		}
		if ((user === targetUser || user.can('alts', targetUser)) && hiddenrooms) {
			buf += `<br />Hidden rooms: ${hiddenrooms}`;
		}
		const staffViewingLocked = user.can('alts', targetUser) && targetUser.locked;
		if ((user === targetUser || user.can('makeroom') || staffViewingLocked) && privaterooms) {
			buf += `<br />Private rooms: ${privaterooms}`;
		}

		if (user.can('alts', targetUser) || (room.isPrivate !== true && user.can('mute', targetUser, room) && targetUser.userid in room.users)) {
			let punishments = Punishments.getRoomPunishments(targetUser, {checkIps: true});

			if (punishments.length) {
				buf += `<br />Room punishments: `;

				buf += punishments.map(([room, punishment]) => {
					const [punishType, punishUserid, expireTime, reason] = punishment;
					let punishDesc = Punishments.roomPunishmentTypes.get(punishType);
					if (!punishDesc) punishDesc = `punished`;
					if (punishUserid !== targetUser.userid) punishDesc += ` as ${punishUserid}`;
					let expiresIn = new Date(expireTime).getTime() - Date.now();
					let expireString = Chat.toDurationString(expiresIn, {precision: 1});
					punishDesc += ` for ${expireString}`;

					if (reason) punishDesc += `: ${reason}`;
					return `<a href="/${room}">${room}</a> (${punishDesc})`;
				}).join(', ');
			}
		}
		this.sendReplyBox(buf);
	},
	whoishelp: [
		`/whois - Get details on yourself: alts, group, IP address, and rooms.`,
		`/whois [username] - Get details on a username: alts (Requires: % @ * & ~), group, IP address (Requires: @ * & ~), and rooms.`,
	],

	'!offlinewhois': true,
	checkpunishment: 'offlinewhois',
	offlinewhois: function (target, room, user) {
		if (!user.trusted) {
			return this.errorReply("/offlinewhois - Access denied.");
		}
		let userid = toId(target);
		if (!userid) return this.errorReply("Please enter a valid username.");
		let targetUser = Users(userid);
		let buf = Chat.html`<strong class="username">${target}</strong>`;
		if (!targetUser || !targetUser.connected) buf += ` <em style="color:gray">(offline)</em>`;

		let roomauth = '';
		if (room && room.auth && userid in room.auth) roomauth = room.auth[userid];
		if (Config.groups[roomauth] && Config.groups[roomauth].name) {
			buf += `<br />${Config.groups[roomauth].name} (${roomauth})`;
		}
		let group = (Users.usergroups[userid] || '').charAt(0);
		if (Config.groups[group] && Config.groups[group].name) {
			buf += `<br />Global ${Config.groups[group].name} (${group})`;
		}

		buf += `<br /><br />`;
		let atLeastOne = false;

		let punishment = Punishments.userids.get(userid);
		if (punishment) {
			const [punishType, punishUserid, , reason] = punishment;
			const punishName = (Punishments.punishmentTypes.get(punishType) || punishType).toUpperCase();
			buf += `${punishName}: ${punishUserid}`;
			let expiresIn = Punishments.checkLockExpiration(userid);
			if (expiresIn) buf += expiresIn;
			if (reason) buf += Chat.html` (reason: ${reason})`;
			buf += '<br />';
			atLeastOne = true;
		}

		if (!user.can('alts') && !atLeastOne) {
			let hasJurisdiction = room && user.can('mute', null, room) && Punishments.roomUserids.nestedHas(room.id, userid);
			if (!hasJurisdiction) {
				return this.errorReply("/checkpunishment - User not found.");
			}
		}

		let punishments = Punishments.getRoomPunishments(targetUser || {userid});

		if (punishments && punishments.length) {
			buf += `<br />Room punishments: `;

			buf += punishments.map(([room, punishment]) => {
				const [punishType, punishUserid, expireTime, reason] = punishment;
				let punishDesc = Punishments.roomPunishmentTypes.get(punishType);
				if (!punishDesc) punishDesc = `punished`;
				if (punishUserid !== userid) punishDesc += ` as ${punishUserid}`;
				let expiresIn = new Date(expireTime).getTime() - Date.now();
				let expireString = Chat.toDurationString(expiresIn, {precision: 1});
				punishDesc += ` for ${expireString}`;

				if (reason) punishDesc += `: ${reason}`;
				return `<a href="/${room}">${room}</a> (${punishDesc})`;
			}).join(', ');
			atLeastOne = true;
		}
		if (!atLeastOne) {
			buf += `This username has no punishments associated with it.`;
		}
		this.sendReplyBox(buf);
	},

	'!host': true,
	host: function (target, room, user, connection, cmd) {
		if (!target) return this.parse('/help host');
		if (!this.can('rangeban')) return;
		target = target.trim();
		if (!/^[0-9.]+$/.test(target)) return this.errorReply('You must pass a valid IPv4 IP to /host.');
		Dnsbl.reverse(target).then(host => {
			this.sendReply('IP ' + target + ': ' + (host || "ERROR"));
		});
	},
	hosthelp: [`/host [ip] - Gets the host for a given IP. Requires: & ~`],

	'!ipsearch': true,
	searchip: 'ipsearch',
	ipsearchall: 'ipsearch',
	hostsearch: 'ipsearch',
	ipsearch: function (target, room, user, connection, cmd) {
		if (!target.trim()) return this.parse(`/help ipsearch`);
		if (!this.can('rangeban')) return;

		target = this.splitTargetText(target).trim();
		let targetIp = this.targetUsername;
		let targetRoom = target.length ? Rooms(target.trim()) : null;
		if (!targetRoom && targetRoom !== null) return this.errorReply(`The room "${target}" does not exist.`);
		let results = [];
		let isAll = (cmd === 'ipsearchall');

		if (/[a-z]/.test(targetIp)) {
			// host
			this.sendReply(`Users with host ${targetIp}${targetRoom ? ` in the room ${targetRoom.title}` : ``}:`);
			Users.users.forEach(curUser => {
				if (results.length > 100 && !isAll) return;
				if (!curUser.latestHost || !curUser.latestHost.endsWith(targetIp)) return;
				if (targetRoom && !curUser.inRooms.has(targetRoom.id)) return;
				results.push((curUser.connected ? " \u25C9 " : " \u25CC ") + " " + curUser.name);
			});
			if (results.length > 100 && !isAll) {
				return this.sendReply(`More than 100 users match the specified IP range. Use /ipsearchall to retrieve the full list.`);
			}
		} else if (targetIp.slice(-1) === '*') {
			// IP range
			this.sendReply(`Users in IP range ${targetIp}${targetRoom ? ` in the room ${targetRoom.title}` : ``}:`);
			targetIp = targetIp.slice(0, -1);
			Users.users.forEach(curUser => {
				if (results.length > 100 && !isAll) return;
				if (!curUser.latestIp.startsWith(targetIp)) return;
				if (targetRoom && !curUser.inRooms.has(targetRoom.id)) return;
				results.push((curUser.connected ? " \u25C9 " : " \u25CC ") + " " + curUser.name);
			});
			if (results.length > 100 && !isAll) {
				return this.sendReply(`More than 100 users match the specified IP range. Use /ipsearchall to retrieve the full list.`);
			}
		} else {
			this.sendReply(`Users with IP ${targetIp}${targetRoom ? ` in the room ${targetRoom.title}` : ``}:`);
			Users.users.forEach(curUser => {
				if (curUser.latestIp !== targetIp) return;
				if (targetRoom && !curUser.inRooms.has(targetRoom.id)) return;
				results.push((curUser.connected ? " \u25C9 " : " \u25CC ") + " " + curUser.name);
			});
		}
		if (!results.length) {
			if (!targetIp.includes('.')) return this.errorReply(`${targetIp} is not a valid IP or host.`);
			return this.sendReply(`No results found.`);
		}
		return this.sendReply(results.join('; '));
	},
	ipsearchhelp: [`/ipsearch [ip|range|host], (room) - Find all users with specified IP, IP range, or host. If a room is provided only users in the room will be shown. Requires: & ~`],

	checkchallenges: function (target, room, user) {
		if (!this.can('ban', null, room)) return false;
		if (!this.runBroadcast()) return;
		if (!this.broadcasting) {
			this.errorReply(`This command must be broadcast:`);
			return this.parse(`/help checkchallenges`);
		}
		target = this.splitTarget(target);
		const user1 = this.targetUser;
		const user2 = Users.get(target);
		if (!user1 || !user2 || user1 === user2) return this.parse(`/help checkchallenges`);
		if (!(user1 in room.users) || !(user2 in room.users)) {
			return this.errorReply(`Both users must be in this room.`);
		}
		let challenges = [];
		const user1Challs = Ladders.challenges.get(user1.userid);
		if (user1Challs) {
			for (const chall of user1Challs) {
				if (chall.from === user1.userid && Users.get(chall.to) === user2) {
					challenges.push(Chat.html`${user1.name} is challenging ${user2.name} in ${Dex.getFormat(chall.formatid).name}.`);
					break;
				}
			}
		}
		const user2Challs = Ladders.challenges.get(user2.userid);
		if (user2Challs) {
			for (const chall of user2Challs) {
				if (chall.from === user2.userid && Users.get(chall.to) === user1) {
					challenges.push(Chat.html`${user2.name} is challenging ${user1.name} in ${Dex.getFormat(chall.formatid).name}.`);
					break;
				}
			}
		}
		if (!challenges.length) {
			return this.sendReplyBox(Chat.html`${user1.name} and ${user2.name} are not challenging each other.`);
		}
		this.sendReplyBox(challenges.join(`<br />`));
	},
	checkchallengeshelp: [`!checkchallenges [user1], [user2] - Check if the specified users are challenging each other. Requires: @ * # & ~`],

	/*********************************************************
	 * Client fallback
	 *********************************************************/

	unignore: 'ignore',
	ignore: function (target, room, user) {
		if (!room) this.errorReply(`In PMs, this command can only be used by itself to ignore the person you're talking to: "/${this.cmd}", not "/${this.cmd} ${target}"`);
		this.errorReply(`You're using a custom client that doesn't support the ignore command.`);
	},

	/*********************************************************
	 * Data Search Dex
	 *********************************************************/

	'!data': true,
	pstats: 'data',
	stats: 'data',
	dex: 'data',
	pokedex: 'data',
	data: function (target, room, user, connection, cmd) {
		if (!this.runBroadcast()) return;

		let buffer = '';
		let sep = target.split(',');
		if (sep.length !== 2) sep = [target];
		target = sep[0].trim();
		let targetId = toId(target);
		if (!targetId) return this.parse('/help data');
		let targetNum = parseInt(targetId);
		if (!isNaN(targetNum) && '' + targetNum === target) {
			for (let p in Dex.data.Pokedex) {
				let pokemon = Dex.getTemplate(p);
				if (pokemon.num === targetNum) {
					target = pokemon.species;
					targetId = pokemon.id;
					break;
				}
			}
		}
		let mod = Dex;
		if (sep[1] && toId(sep[1]) in Dex.dexes) {
			mod = Dex.mod(toId(sep[1]));
		} else if (sep[1] && Dex.getFormat(sep[1]).mod) {
			mod = Dex.mod(Dex.getFormat(sep[1]).mod);
		} else if (room && room.battle) {
			mod = Dex.forFormat(room.battle.format);
		}
		let newTargets = mod.dataSearch(target);
		let showDetails = (cmd === 'dt' || cmd === 'details');
		if (newTargets && newTargets.length) {
			for (const [i, newTarget] of newTargets.entries()) {
				if (newTarget.isInexact && !i) {
					buffer = `No Pok\u00e9mon, item, move, ability or nature named '${target}' was found${Dex.gen > mod.gen ? ` in Gen ${mod.gen}` : ""}. Showing the data of '${newTargets[0].name}' instead.\n`;
				}
				switch (newTarget.searchType) {
				case 'nature':
					let nature = Dex.getNature(newTarget.name);
					buffer += "" + nature.name + " nature: ";
					if (nature.plus) {
						let statNames = {'atk': "Attack", 'def': "Defense", 'spa': "Special Attack", 'spd': "Special Defense", 'spe': "Speed"};
						buffer += "+10% " + statNames[nature.plus] + ", -10% " + statNames[nature.minus] + ".";
					} else {
						buffer += "No effect.";
					}
					return this.sendReply(buffer);
				case 'pokemon':
					let template = mod.getTemplate(newTarget.name);
					buffer += `|raw|${Chat.getDataPokemonHTML(template, mod.gen)}\n`;
					break;
				case 'item':
					let item = mod.getItem(newTarget.name);
					buffer += `|raw|${Chat.getDataItemHTML(item)}\n`;
					break;
				case 'move':
					let move = mod.getMove(newTarget.name);
					buffer += `|raw|${Chat.getDataMoveHTML(move)}\n`;
					break;
				case 'ability':
					let ability = mod.getAbility(newTarget.name);
					buffer += `|raw|${Chat.getDataAbilityHTML(ability)}\n`;
					break;
				default:
					throw new Error(`Unrecognized searchType`);
				}
			}
		} else {
			return this.errorReply(`No Pok\u00e9mon, item, move, ability or nature named '${target}' was found${Dex.gen > mod.gen ? ` in Gen ${mod.gen}` : ""}. (Check your spelling?)`);
		}

		if (showDetails) {
			let details;
			if (newTargets[0].searchType === 'pokemon') {
				let pokemon = mod.getTemplate(newTargets[0].name);
				let weighthit = 20;
				if (pokemon.weightkg >= 200) {
					weighthit = 120;
				} else if (pokemon.weightkg >= 100) {
					weighthit = 100;
				} else if (pokemon.weightkg >= 50) {
					weighthit = 80;
				} else if (pokemon.weightkg >= 25) {
					weighthit = 60;
				} else if (pokemon.weightkg >= 10) {
					weighthit = 40;
				}
				details = {
					"Dex#": pokemon.num,
					"Gen": pokemon.gen || 'CAP',
					"Height": pokemon.heightm + " m",
					"Weight": pokemon.weightkg + " kg <em>(" + weighthit + " BP)</em>",
				};
				if (pokemon.color && mod.gen >= 5) details["Dex Colour"] = pokemon.color;
				if (pokemon.eggGroups && mod.gen >= 2) details["Egg Group(s)"] = pokemon.eggGroups.join(", ");
				let evos = [];
				pokemon.evos.forEach(evo => {
					evo = mod.getTemplate(evo);
					if (evo.gen <= mod.gen) {
						evos.push(evo.name + " (" + evo.evoLevel + ")");
					}
				});
				if (!evos.length) {
					details['<font color="#686868">Does Not Evolve</font>'] = "";
				} else {
					details["Evolution"] = evos.join(", ");
				}
			} else if (newTargets[0].searchType === 'move') {
				let move = mod.getMove(newTargets[0].name);
				details = {
					"Priority": move.priority,
					"Gen": move.gen || 'CAP',
				};

				if (move.secondary || move.secondaries) details["&#10003; Secondary effect"] = "";
				if (move.flags['contact']) details["&#10003; Contact"] = "";
				if (move.flags['sound']) details["&#10003; Sound"] = "";
				if (move.flags['bullet']) details["&#10003; Bullet"] = "";
				if (move.flags['pulse']) details["&#10003; Pulse"] = "";
				if (!move.flags['protect'] && !/(ally|self)/i.test(move.target)) details["&#10003; Bypasses Protect"] = "";
				if (move.flags['authentic']) details["&#10003; Bypasses Substitutes"] = "";
				if (move.flags['defrost']) details["&#10003; Thaws user"] = "";
				if (move.flags['bite']) details["&#10003; Bite"] = "";
				if (move.flags['punch']) details["&#10003; Punch"] = "";
				if (move.flags['powder']) details["&#10003; Powder"] = "";
				if (move.flags['reflectable']) details["&#10003; Bounceable"] = "";
				if (move.flags['gravity'] && mod.gen >= 4) details["&#10007; Suppressed by Gravity"] = "";

				if (mod.gen >= 7) {
					if (move.zMovePower) {
						details["Z-Power"] = move.zMovePower;
					} else if (move.zMoveEffect) {
						details["Z-Effect"] = {
							'clearnegativeboost': "Restores negative stat stages to 0",
							'crit2': "Crit ratio +2",
							'heal': "Restores HP 100%",
							'curse': "Restores HP 100% if user is Ghost type, otherwise Attack +1",
							'redirect': "Redirects opposing attacks to user",
							'healreplacement': "Restores replacement's HP 100%",
						}[move.zMoveEffect];
					} else if (move.zMoveBoost) {
						details["Z-Effect"] = "";
						let boost = move.zMoveBoost;
						let stats = {atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', accuracy: 'Accuracy', evasion: 'Evasiveness'};
						for (let i in boost) {
							details["Z-Effect"] += " " + stats[i] + " +" + boost[i]

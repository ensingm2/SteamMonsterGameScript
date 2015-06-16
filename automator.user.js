// ==UserScript== 
// @name [ensingm2] Steam Monster Game Script
// @namespace https://github.com/ensingm2/SteamMonsterGameScript
// @description A Javascript automator for the 2015 Summer Steam Monster Minigame
// @version 2.07
// @match http://steamcommunity.com/minigame/towerattack*
// @match http://steamcommunity.com//minigame/towerattack*
// @updateURL https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/automator.user.js
// @downloadURL https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/automator.user.js
// @require https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/slaveWindows.js?ver=2_06
// @grant none
// ==/UserScript==

// Compiled and customized by https://github.com/ensingm2
// See a (hopefully) full list of contributors over at https://github.com/ensingm2/SteamMonsterGameScript#contributors

// Custom variables
var debug = false;
var clicksPerSecond = g_TuningData.abilities[1].max_num_clicks;
var autoClickerVariance = Math.floor(clicksPerSecond / 10);
clicksPerSecond -= Math.ceil(autoClickerVariance / 2);
var respawnCheckFreq = 5000;
var targetSwapperFreq = 1000;
var abilityUseCheckFreq = 2000;
var itemUseCheckFreq = 5000;
var seekHealingPercent = 20;
var upgradeManagerFreq = 5000;
var slowRenderingFreq = 1000;
var autoBuyAbilities = false;
var refreshDelay = 3600000; //Page refresh every 60min
var spamStatBoosters = true;

// Boss Nuke Variables
var nukeBossesAfterLevel = 1000;
var farmGoldOnBossesLevelDiff = 200;
var useNukeOnBossAbovePercent = 25;

//Controls to sync us up with other scripts 
var CONTROL = {
	speedThreshold: 5000, // use gold rain every boss round after here
	rainingRounds: 250, // use gold rain every x rounds
	disableGoldRainLevels: 500 // min level to use gold rain on
};

//item use variables
var useMedicsAtPercent = 40;
var useMedicsAtLanePercent = 70;
var useMedicsAtLanePercentAliveReq = 30;
var useNukeOnSpawnerAbovePercent = 75;
var useMetalDetectorOnBossBelowPercent = 30;

var useStealHealthAtPercent = 15;
var useRainingGoldAbovePercent = 50;
var useLikeNewAboveCooldown = 14220000; // Need to save at least 14220s of cooldowns(60% of max)
var useResurrectToSaveCount = 150; // Use revive to save 150 people
var minutesBufferForConsumableDump = 10;

// You shouldn't need to ever change this, you only push to server every 1s anyway
var autoClickerFreq = 1000;

// Internal variables, you shouldn't need to touch these
var autoRespawner, autoClicker, autoTargetSwapper, autoTargetSwapperElementUpdate, autoAbilityUser, autoUpgradeManager, fpsThrottle, spammer;
var elementUpdateRate = 60000;
var autoUseConsumables = true;
var userElementMultipliers = [1, 1, 1, 1];
var userMaxElementMultiiplier = 1;
var swapReason;
var lastLootLevel = 0;
var lastLootCache = [];

var ABILITIES = {
	FIRE_WEAPON: 1,
	CHANGE_LANE: 2,
	RESPAWN: 3,
	CHANGE_TARGET: 4,
	MORALE_BOOSTER: 5,
	GOOD_LUCK_CHARMS: 6,
	MEDICS: 7,
	METAL_DETECTOR: 8,
	DECREASE_COOLDOWNS: 9,
	TACTICAL_NUKE: 10,
	CLUSTER_BOMB: 11,
	NAPALM: 12,
	RESURRECTION: 13,
	CRIPPLE_SPAWNER: 14,
	CRIPPLE_MONSTER: 15,
	MAX_ELEMENTAL_DAMAGE: 16,
	RAINING_GOLD: 17,
	CRIT: 18,
	PUMPED_UP: 19,
	THROW_MONEY_AT_SCREEN: 20,
	GOD_MODE: 21,
	TREASURE: 22,
	STEAL_HEALTH: 23,
	REFLECT_DAMAGE: 24,
	FEELING_LUCKY: 25,
	WORMHOLE: 26,
	LIKE_NEW: 27
};

function startAllAutos() {
	startAutoClicker();
	startAutoRespawner();
	startAutoTargetSwapper();
	startAutoAbilityUser();
	startAutoUpgradeManager();
}

function stopAllAutos() {
	stopAutoClicker();
	stopAutoRespawner();
	stopAutoTargetSwapper();
	stopAutoAbilityUser();
	stopAutoItemUser();
	stopAutoUpgradeManager();
}

//Keep trying to start every second till success
var startAttempts = 0;
var startAll = setInterval(function() {
	if (!gameRunning()) {
		//Don't refresh if we're waiting on game to start
		if (g_Minigame.m_CurrentScene.m_rgGameData.status != 1) {
			//Refresh if the game still isn't running after 15s
			if (startAttempts > 15)
				location.reload();

			startAttempts++;
		}
		return;
	}

	clearInterval(startAll);

	startAllAutos();
	initGUI();

	//Start leaderboard (if user is running userscript)
	if (typeof unsafeWindow != 'undefined')
		initLeaderboard();

	if (typeof runMaster == 'function') {
		//Setup for slave windows
		if (location.search.match(/slave/))
			runSlave();
		else
			runMaster();
	}

	//Keep Playing while minimized - http://www.reddit.com/r/SteamMonsterGame/comments/39yng9/keep_autoclicking_after_minimizingchanging_tabs/
	setInterval(function(p) {
		return p.Tick = eval("(" + ("" + p.Tick).replace(/document\.(hidden|webkitHidden|mozHidden|msHidden)/g, !1) + ")"),
			function() {
				p = g_Minigame.m_CurrentScene, p && document.hidden && p.Tick()
			}
	}(CSceneGame.prototype), 1000);

	setTimeout(function() {
		//Try to reload every 15s
		var reloader = setInterval(function() {
			//No raining gold, treasure mob, boss, or miniboss
			var target = getTarget();
			var reload = !currentLaneHasAbility(ABILITIES.RAINING_GOLD) && target.m_data.type != 4 && target.m_data.type != 2 && target.m_data.type != 3 && target.m_data.type !== false;
			if (reload) {
				clearInterval(reloader);
				location.reload();
			}
		}, 15000);
	}, refreshDelay);
}, 1000);

//Expose functions if running in userscript
if (typeof unsafeWindow != 'undefined') {
	// Variables
	unsafeWindow.debug = debug;
	unsafeWindow.clicksPerSecond = clicksPerSecond;
	unsafeWindow.autoClickerVariance = autoClickerVariance;
	unsafeWindow.respawnCheckFreq = respawnCheckFreq;
	unsafeWindow.targetSwapperFreq = targetSwapperFreq;
	unsafeWindow.abilityUseCheckFreq = abilityUseCheckFreq;
	unsafeWindow.itemUseCheckFreq = itemUseCheckFreq;
	unsafeWindow.seekHealingPercent = seekHealingPercent;
	unsafeWindow.upgradeManagerFreq = upgradeManagerFreq;
	unsafeWindow.autoBuyAbilities = autoBuyAbilities;
	unsafeWindow.fpsThrottle = fpsThrottle;

	//item use variables
	unsafeWindow.useMedicsAtPercent = useMedicsAtPercent;
	unsafeWindow.useMedicsAtLanePercent = useMedicsAtLanePercent;
	unsafeWindow.useMedicsAtLanePercentAliveReq = useMedicsAtLanePercentAliveReq;
	unsafeWindow.useNukeOnSpawnerAbovePercent = useNukeOnSpawnerAbovePercent;
	unsafeWindow.useMetalDetectorOnBossBelowPercent = useMetalDetectorOnBossBelowPercent;
	unsafeWindow.useStealHealthAtPercent = useStealHealthAtPercent;
	unsafeWindow.useRainingGoldAbovePercent = useRainingGoldAbovePercent;
	unsafeWindow.autoUseConsumables = autoUseConsumables;
	unsafeWindow.useResurrectToSaveCount = useResurrectToSaveCount;
	unsafeWindow.spamStatBoosters = spamStatBoosters;

	//Slave window variables
	unsafeWindow.slaveWindowUICleanup = slaveWindowUICleanup;
	unsafeWindow.slaveWindowPeriodicRestart = slaveWindowPeriodicRestart;
	unsafeWindow.slaveWindowPeriodicRestartInterval = slaveWindowPeriodicRestartInterval;

	//Boss nuke vars
	unsafeWindow.nukeBossesAfterLevel = nukeBossesAfterLevel;
	unsafeWindow.farmGoldOnBossesLevelDiff = farmGoldOnBossesLevelDiff;
	unsafeWindow.useNukeOnBossAbovePercent = useNukeOnBossAbovePercent;

	// Functions
	unsafeWindow.startAutoClicker = startAutoClicker;
	unsafeWindow.startAutoRespawner = startAutoRespawner;
	unsafeWindow.startAutoTargetSwapper = startAutoTargetSwapper;
	unsafeWindow.startAutoAbilityUser = startAutoAbilityUser;
	unsafeWindow.startAutoItemUser = startAutoItemUser;
	unsafeWindow.startAllAutos = startAllAutos;
	unsafeWindow.startAutoUpgradeManager = startAutoUpgradeManager;
	unsafeWindow.stopAutoClicker = stopAutoClicker;
	unsafeWindow.stopAutoRespawner = stopAutoRespawner;
	unsafeWindow.stopAutoTargetSwapper = stopAutoTargetSwapper;
	unsafeWindow.stopAutoAbilityUser = stopAutoAbilityUser;
	unsafeWindow.stopAutoItemUser = stopAutoItemUser;
	unsafeWindow.stopAutoUpgradeManager = stopAutoUpgradeManager;
	unsafeWindow.stopAllAutos = stopAllAutos;
	unsafeWindow.disableAutoNukes = disableAutoNukes;
	unsafeWindow.castAbility = castAbility;
	unsafeWindow.hasAbility = hasAbility;
	unsafeWindow.abilityIsUnlocked = abilityIsUnlocked;
	unsafeWindow.abilityCooldown = abilityCooldown;
	unsafeWindow.toggleAutoClicker = toggleAutoClicker;
	unsafeWindow.toggleAutoTargetSwapper = toggleAutoTargetSwapper;
	unsafeWindow.toggleAutoAbilityUser = toggleAutoAbilityUser;
	unsafeWindow.toggleAutoItemUser = toggleAutoItemUser;
	unsafeWindow.toggleAutoUpgradeManager = toggleAutoUpgradeManager;
	unsafeWindow.spamNoClick = spamNoClick;
	unsafeWindow.toggleSpammer = toggleSpammer;
	unsafeWindow.getTarget = getTarget;
	unsafeWindow.currentLaneHasAbility = currentLaneHasAbility;
	unsafeWindow.laneHasAbility = laneHasAbility;
	unsafeWindow.getMobTypePriority = getMobTypePriority;
	unsafeWindow.updateStats = updateStats;

	//Hacky way to let people change vars using userscript before I set up getter/setter fns tomorrow
	var varSetter = setInterval(function() {
		if (debug)
			console.log('updating options');

		// Main vars
		debug = unsafeWindow.debug;
		clicksPerSecond = unsafeWindow.clicksPerSecond;
		autoClickerVariance = unsafeWindow.autoClickerVariance;
		respawnCheckFreq = unsafeWindow.respawnCheckFreq;
		targetSwapperFreq = unsafeWindow.targetSwapperFreq;
		abilityUseCheckFreq = unsafeWindow.abilityUseCheckFreq;
		itemUseCheckFreq = unsafeWindow.itemUseCheckFreq;
		seekHealingPercent = unsafeWindow.seekHealingPercent;
		upgradeManagerFreq = unsafeWindow.upgradeManagerFreq;
		autoBuyAbilities = unsafeWindow.autoBuyAbilities;
		fpsThrottle = unsafeWindow.fpsThrottle;

		//item use variables
		useMedicsAtPercent = unsafeWindow.useMedicsAtPercent;
		useMedicsAtLanePercent = unsafeWindow.useMedicsAtLanePercent;
		useMedicsAtLanePercentAliveReq = unsafeWindow.useMedicsAtLanePercentAliveReq;
		useNukeOnSpawnerAbovePercent = unsafeWindow.useNukeOnSpawnerAbovePercent;
		useMetalDetectorOnBossBelowPercent = unsafeWindow.useMetalDetectorOnBossBelowPercent;
		useStealHealthAtPercent = unsafeWindow.useStealHealthAtPercent;
		useRainingGoldAbovePercent = unsafeWindow.useRainingGoldAbovePercent;
		useResurrectToSaveCount = unsafeWindow.useResurrectToSaveCount;
		spamStatBoosters = unsafeWindow.spamStatBoosters;

		//Boss nuke vars
		nukeBossesAfterLevel = unsafeWindow.nukeBossesAfterLevel;
		farmGoldOnBossesLevelDiff = unsafeWindow.farmGoldOnBossesLevelDiff;
		useNukeOnBossAbovePercent = unsafeWindow.useNukeOnBossAbovePercent;

	}, 5000);

	//Add closure 'debug' getter and setter
	unsafeWindow.getDebug = function() {
		return debug;
	};
	unsafeWindow.setDebug = function(state) {
		debug = state;
	};
}

// ================ AUTO CLICKER ================
function startAutoClicker() {
	if (autoClicker) {
		console.log("Autoclicker is already running!");
		return;
	}

	autoClicker = setInterval(function() {
		if (!gameRunning()) return;

		//Vary the number of clicks by up to the autoClickerVariance variable (plus or minus)
		var randomVariance = Math.floor(Math.random() * autoClickerVariance * 2) - (autoClickerVariance);
		var clicks = clicksPerSecond + randomVariance;

		// Set the variable to be sent to the server
		g_Minigame.m_CurrentScene.m_nClicks += clicks;

		// Anti-anti-clicker countermeasure
		g_msTickRate = 1100;

		// Update Gold Counter
		var nClickGoldPct = g_Minigame.m_CurrentScene.m_rgGameData.lanes[g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane].active_player_ability_gold_per_click;
		var enemy = getTarget();
		if (enemy && nClickGoldPct > 0 && enemy.m_data.hp > 0) {
			var nClickGold = enemy.m_data.gold * nClickGoldPct * g_Minigame.m_CurrentScene.m_nClicks;
			g_Minigame.m_CurrentScene.ClientOverride('player_data', 'gold', g_Minigame.m_CurrentScene.m_rgPlayerData.gold + nClickGold);
			g_Minigame.m_CurrentScene.ApplyClientOverrides('player_data', true);
		}

		//Clear out the crits
		var numCrits = g_Minigame.m_CurrentScene.m_rgStoredCrits.length;
		g_Minigame.m_CurrentScene.m_rgStoredCrits = [];

		if (debug) {
			if (numCrits > 1)
				console.log('Clicking ' + g_Minigame.m_CurrentScene.m_nClicks + ' times this second. (' + numCrits + ' crits).');
			if (numCrits == 1)
				console.log('Clicking ' + g_Minigame.m_CurrentScene.m_nClicks + ' times this second. (1 crit).');
			else
				console.log('Clicking ' + g_Minigame.m_CurrentScene.m_nClicks + ' times this second.');

			//Calculate Damage done
			var damage = g_Minigame.m_CurrentScene.CalculateDamage(g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_per_click * userMaxElementMultiiplier * g_Minigame.m_CurrentScene.m_nClicks);
			var damageStr = "(unknown)";
			if (damage > 1000000000)
				damageStr = (damage / 1000000000) + "B";
			else if (damage > 1000000)
				damageStr = (damage / 1000000) + "M";
			else if (damage > 1000)
				damageStr = (damage / 1000) + "K";
			console.log('We did roughly ' + damageStr + ' damage in the last second.');
		}

	}, autoClickerFreq);

	console.log("autoClicker has been started.");
}

function stopAutoClicker() {
	if (autoClicker) {
		clearInterval(autoClicker);
		autoClicker = null;
		console.log("autoClicker has been stopped.");
	} else
		console.log("No autoClicker is running to stop.");
}

// ================ AUTO ABILITY ITEM USE ================
function startAutoAbilityUser() {
	if (autoAbilityUser) {
		console.log("autoAbilityUser is already running!");
		return;
	}

	autoAbilityUser = setInterval(function() {

		if (debug)
			console.log("Checking if it's useful to use an ability.");

		var percentHPRemaining = g_Minigame.CurrentScene().m_rgPlayerData.hp / g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp * 100;
		var target = getTarget();

		var currentLane = g_Minigame.m_CurrentScene.m_rgGameData.lanes[g_Minigame.CurrentScene().m_rgPlayerData.current_lane];
		var lvl = getGameLevel();
		
		// Use any consumables that you won't run out of before round end
		for (var key in ABILITIES) {
			if (ABILITIES.hasOwnProperty(key)) {
				var abilityID = ABILITIES[key];
				//Only check consumables
				if (abilityID >= ABILITIES.RESURRECT) {
					var ignoreBufferPeriod = (abilityID == ABILITIES.THROW_MONEY_AT_SCREEN);
					if(hasTimeLeftToUseConsumable(abilityID, ignoreBufferPeriod))
						cast(abilityID);
				}
			}
		}
		
		// Wormholes -- use before wasting items on lanes
		if (hasAbility(ABILITIES.WORMHOLE) && autoUseConsumables) {
			if (((getEstimatedLevelsLeft() % 500) < getAbilityItemQuantity(ABILITIES.WORMHOLE) && lvl % 500 === 0) || hasTimeLeftToUseConsumable(ABILITIES.WORMHOLE, false)) { // Use wormhole as close to the end on every 500th level (causes a 10 level jump instead of a 1 to keep in line with wchill and SteamDB scripts, maybe add level minimum like 100k)
				if (debug)
					console.log("Casting Wormhole! Allons-y!!!");
				castAbility(ABILITIES.WORMHOLE);
			}
		}

		// Spam permanent stat boosters if set
		if(spamStatBoosters){
			// Crit
			if(getAbilityItemQuantity(18))
				castAbility(18);
			
			// Pumped Up
			if(getAbilityItemQuantity(19))
				castAbility(19);
		}
		
		// Abilities only used on targets
		if (target) {

			var targetPercentHPRemaining = target.m_data.hp / target.m_data.max_hp * 100;
			var laneDPS = g_Minigame.m_CurrentScene.m_rgLaneData[g_Minigame.CurrentScene().m_rgPlayerData.current_lane].friendly_dps;
			var timeToTargetDeath = target.m_data.hp / laneDPS;

			// First priority since it can use Decrease Cooldowns

			//Nuke bosses after the 1000th level and not every 200th level thereafter
			var nukeBosses = (g_Minigame.m_CurrentScene.m_nCurrentLevel + 1 >= nukeBossesAfterLevel) && ((g_Minigame.m_CurrentScene.m_nCurrentLevel + 1) % farmGoldOnBossesLevelDiff !== 0);

			var isBoss = (target.m_data.type == 2 || target.m_data.type === false); // Assume false is a boss

			// Abilities only used when targeting Spawners (sub lvl 1000) or nuking bosses (above level 1k)
			if ((target.m_data.type === 0 && g_Minigame.m_CurrentScene.m_nCurrentLevel + 1 >= nukeBossesAfterLevel) || (isBoss && nukeBosses)) {
				// Morale Booster, Good Luck Charm, and Decrease Cooldowns
				var moraleBoosterReady = hasAbility(ABILITIES.MORALE_BOOSTER);
				var goodLuckCharmReady = hasAbility(ABILITIES.GOOD_LUCK_CHARMS);
				var critReady = (hasAbility(ABILITIES.CRIT) && autoUseConsumables);

				// Only use items on targets that are spawners and have nearly full health
				if (targetPercentHPRemaining >= 90 && autoUseConsumables && (hasAbility(ABILITIES.CRIPPLE_SPAWNER) || hasAbility(ABILITIES.CRIPPLE_MONSTER))) {
					// Check to see if Cripple Spawner and Cripple Monster items are ready to use
					if (hasAbility(ABILITIES.CRIPPLE_SPAWNER)) {
						castAbility(ABILITIES.CRIPPLE_SPAWNER);
					} else if (hasAbility(ABILITIES.CRIPPLE_MONSTER)) {
						castAbility(ABILITIES.CRIPPLE_MONSTER);
					}
				} else if (moraleBoosterReady || critReady || goodLuckCharmReady) {
					// If we have both we want to combo them
					var moraleBoosterUnlocked = abilityIsUnlocked(ABILITIES.MORALE_BOOSTER);
					var goodLuckCharmUnlocked = abilityIsUnlocked(ABILITIES.GOOD_LUCK_CHARMS);

					// "if Moral Booster isn't unlocked or Good Luck Charm isn't unlocked, or both are ready"
					if ((!moraleBoosterUnlocked && !critReady) || !goodLuckCharmUnlocked || ((moraleBoosterReady || critReady) && (goodLuckCharmReady || !goodLuckCharmUnlocked))) {
						var currentLaneHasCooldown = currentLaneHasAbility(ABILITIES.DECREASE_COOLDOWNS);
						// Only use on targets that are spawners and have nearly full health
						if (targetPercentHPRemaining >= 70 || (currentLaneHasCooldown && targetPercentHPRemaining >= 60)) {
							// Combo these with Decrease Cooldowns ability

							// If Decreased Cooldowns will be available soon, wait
							if (
								currentLaneHasCooldown || // If current lane already has Decreased Cooldown, or
								hasAbility(ABILITIES.DECREASE_COOLDOWNS) || // If we have the ability ready
								!abilityIsUnlocked(ABILITIES.DECREASE_COOLDOWNS) || // if we haven't unlocked the ability yet, or
								(abilityCooldown(ABILITIES.DECREASE_COOLDOWNS) > 60) // if cooldown > 60
							) {
								if (hasAbility(ABILITIES.DECREASE_COOLDOWNS) && !currentLaneHasAbility(ABILITIES.DECREASE_COOLDOWNS)) {
									// Other abilities won't benifit if used at the same time
									if (debug)
										console.log('Triggering Decrease Cooldown!');
									castAbility(ABILITIES.DECREASE_COOLDOWNS);
								} else {
									// Use these abilities next pass

									//Use crit if one's available
									if (critReady) {
										if (debug)
											console.log("Using Crit!");
										castAbility(ABILITIES.CRIT);
									} else if (moraleBoosterReady) {
										if (debug)
											console.log("Casting Morale Booster!");
										castAbility(ABILITIES.MORALE_BOOSTER);
									}

									if (goodLuckCharmReady) {
										if (debug)
											console.log("Casting Good Luck Charm!");
										castAbility(ABILITIES.GOOD_LUCK_CHARMS);
									}
								}
							}
						}
					}
				}

				// Tactical Nuke
				if (hasAbility(ABILITIES.TACTICAL_NUKE) && (targetPercentHPRemaining >= useNukeOnSpawnerAbovePercent || (target.m_data.type == 2 && targetPercentHPRemaining >= useNukeOnBossAbovePercent))) {
					if (debug)
						console.log('Nuclear launch detected.');

					castAbility(ABILITIES.TACTICAL_NUKE);
				}

				// Napalm
				else if (target.m_data.type === 0 && hasAbility(ABILITIES.NAPALM) && targetPercentHPRemaining >= useNukeOnSpawnerAbovePercent && currentLane.enemies.length >= 4) {

					if (debug)
						console.log('Triggering napalm!');

					castAbility(ABILITIES.NAPALM);
				}

				// Cluster Bomb
				else if (target.m_data.type === 0 && hasAbility(ABILITIES.CLUSTER_BOMB) && targetPercentHPRemaining >= useNukeOnSpawnerAbovePercent && currentLane.enemies.length >= 4) {

					if (debug)
						console.log('Triggering cluster bomb!');

					castAbility(ABILITIES.CLUSTER_BOMB);
				}

				// Boss Nuke Rounds
				if (isBoss) {

					// Max Elemental Damage
					if (hasAbility(ABILITIES.MAX_ELEMENTAL_DAMAGE) && autoUseConsumables && targetPercentHPRemaining > useNukeOnBossAbovePercent) {
						if (debug)
							console.log('Using Max Elemental Damage on boss.');

						castAbility(ABILITIES.MAX_ELEMENTAL_DAMAGE);
					}

					// Reflect Damage
					if (hasAbility(ABILITIES.REFLECT_DAMAGE) && autoUseConsumables && targetPercentHPRemaining > useNukeOnBossAbovePercent) {
						if (debug)
							console.log('Using Reflect Damage on boss.');

						castAbility(ABILITIES.REFLECT_DAMAGE);
					}
				}
			}

			//Use cases for bosses
			else if (!nukeBosses && isBoss) {
				//Raining Gold
				if (hasAbility(ABILITIES.RAINING_GOLD) && autoUseConsumables && targetPercentHPRemaining > useRainingGoldAbovePercent && timeToTargetDeath > 30 && lvl > CONTROL.disableGoldRainLevels && (lvl <= CONTROL.speedThreshold || lvl % CONTROL.rainingRounds === 0)) {
					if (debug)
						console.log('Using Raining Gold on boss.');

					castAbility(ABILITIES.RAINING_GOLD);
				}
			}

			// Metal Detector
			var treasureReady = hasAbility(ABILITIES.TREASURE) && autoUseConsumables;
			if ((isBoss || target.m_data.type == 4) && timeToTargetDeath < 10) {
				if (hasAbility(ABILITIES.METAL_DETECTOR) || treasureReady) {
					if (treasureReady) {
						if (debug)
							console.log('Using Metal Detector via Treasure.');
						castAbility(ABILITIES.TREASURE);
					} else {
						if (debug)
							console.log('Using Metal Detector.');
						castAbility(ABILITIES.METAL_DETECTOR);
					}
				}
			}
		}

		//Estimate average player HP Percent in lane
		var laneTotalPctHP = 0;
		var laneTotalCount = 0;
		for (var i = 1; i < 10; i++) {
			var HPGuess = ((i - 1) * 10 + 5);
			laneTotalPctHP += HPGuess * currentLane.player_hp_buckets[i];
			laneTotalCount += currentLane.player_hp_buckets[i];
		}
		var avgLanePercentHP = laneTotalPctHP / laneTotalCount;
		var percentAlive = laneTotalCount / (laneTotalCount + currentLane.player_hp_buckets[0]) * 100;

		// Medics
		if ((percentHPRemaining <= useMedicsAtPercent || (avgLanePercentHP <= useMedicsAtLanePercent && percentAlive > useMedicsAtLanePercentAliveReq)) && !g_Minigame.m_CurrentScene.m_bIsDead) {
			if (debug) {
				if (percentHPRemaining <= useMedicsAtPercent)
					console.log("Health below threshold. Need medics!");
				if (avgLanePercentHP <= useMedicsAtLanePercent && percentAlive > useMedicsAtLanePercentAliveReq)
					console.log("Average lane below threshold. Need medics!");
			}

			// Only use if there isn't already a Medics active?
			var pumpedUpReady = hasAbility(ABILITIES.PUMPED_UP) && autoUseConsumables;
			var stealHealthReady = hasAbility(ABILITIES.STEAL_HEALTH) && autoUseConsumables;
			if ((hasAbility(ABILITIES.MEDICS) || pumpedUpReady) && currentLaneHasAbility(ABILITIES.MEDICS) < 2) {

				if (pumpedUpReady) {
					if (debug)
						console.log("Using Medics via Pumped Up!");
					castAbility(ABILITIES.PUMPED_UP);
				} else {
					if (debug)
						console.log("Using Medics!");
					castAbility(ABILITIES.MEDICS);
				}
			} else if (stealHealthReady && percentHPRemaining <= useMedicsAtPercent) {
				if (debug)
					console.log("Using Steal Health in place of Medics!");
				castAbility(ABILITIES.STEAL_HEALTH);
			} else if (debug)
				console.log("No medics to unleash!");
		}

		// Resurrect
		if (hasAbility(ABILITIES.RESURRECTION) && autoUseConsumables) {
			if (currentLane.player_hp_buckets[0] >= useResurrectToSaveCount) {
				if (debug)
					console.log('Using resurrection to save ' + currentLane.player_hp_buckets[0] + ' lane allies.');
				castAbility(ABILITIES.RESURRECTION);
			}
		}

		// Like New
		if (hasAbility(ABILITIES.LIKE_NEW) && autoUseConsumables) {
			var totalCD = 0;
			for (i = 5; i <= 12; i++) {
				if (abilityIsUnlocked(i))
					totalCD += abilityCooldown(i);
			}

			if (totalCD * 1000 >= useLikeNewAboveCooldown) {
				if (debug)
					console.log('Using like new to save a total of ' + totalCD + ' seconds of cooldown.');
				castAbility(ABILITIES.LIKE_NEW);
			}
		}

	}, abilityUseCheckFreq);

	console.log("autoAbilityUser has been started.");
}

function startAutoItemUser() {
	autoUseConsumables = true;
	console.log("Automatic use of consumables has been enabled.");
}

function stopAutoAbilityUser() {
	if (autoAbilityUser) {
		clearInterval(autoAbilityUser);
		autoAbilityUser = null;
		console.log("autoAbilityUser has been stopped.");
	} else
		console.log("No autoAbilityUser is running to stop.");
}

function stopAutoItemUser() {
	autoUseConsumables = false;
	console.log("Automatic use of consumables has been disabled.");
}

function disableAutoNukes() {
	useNukeOnSpawnerAbovePercent = 200;
	console.log('Automatic nukes have been disabled');
}

// ================ AUTO RESPAWNER ================
function startAutoRespawner() {
	if (autoRespawner) {
		console.log("autoRespawner is already running!");
		return;
	}

	autoRespawner = setInterval(function() {
		if (debug)
			console.log('Checking if the player is dead.');

		// Credit to /u/kolodz for base code. http://www.reddit.com/r/SteamMonsterGame/comments/39joz2/javascript_auto_respawn/
		if (g_Minigame.m_CurrentScene.m_bIsDead) {
			if (debug)
				console.log('Player is dead. Respawning.');

			RespawnPlayer();
		}
	}, respawnCheckFreq);

	console.log("autoRespawner has been started.");
}

function stopAutoRespawner() {
	if (autoRespawner) {
		clearInterval(autoRespawner);
		autoRespawner = null;
		console.log("autoRespawner has been stopped.");
	} else
		console.log("No autoRespawner is running to stop.");
}

// ================ AUTO TARGET SWAPPER ================
function startAutoTargetSwapper() {
	if (autoTargetSwapper) {
		console.log("autoTargetSwapper is already running!");
		return;
	}

	updateUserElementMultipliers();
	autoTargetSwapperElementUpdate = setInterval(updateUserElementMultipliers, elementUpdateRate);

	autoTargetSwapper = setInterval(function() {

		if (debug)
			console.log('Looking for a new target.');

		var currentTarget = getTarget();
		g_Minigame.m_CurrentScene.m_rgEnemies.each(function(potentialTarget) {
			if (compareMobPriority(potentialTarget, currentTarget))
				currentTarget = potentialTarget;
		});

		//Switch to that target
		var oldTarget = getTarget();
		if (currentTarget.m_data && oldTarget.m_data && currentTarget.m_data.id != oldTarget.m_data.id) {
			if (debug && swapReason !== null) {
				console.log(swapReason);
				swapReason = null;
			}

			if (g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != currentTarget.m_nLane)
				g_Minigame.m_CurrentScene.TryChangeLane(currentTarget.m_nLane);
			g_Minigame.m_CurrentScene.TryChangeTarget(currentTarget.m_nID);

		}
		//Move back to lane if still targetting
		else if (currentTarget.m_data && g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != currentTarget.m_nLane) {
			g_Minigame.m_CurrentScene.TryChangeLane(currentTarget.m_nLane);
		}

	}, targetSwapperFreq);

	console.log("autoTargetSwapper has been started.");
}

function stopAutoTargetSwapper() {
	if (autoTargetSwapper) {
		clearInterval(autoTargetSwapper);
		autoTargetSwapper = null;
		console.log("autoTargetSwapper has been stopped.");
	} else
		console.log("No autoTargetSwapper is running to stop.");
}

// ================ AUTO UPGRADE MANAGER ================
var upgradeManagerPrefilter;
if (!upgradeManagerPrefilter) {
	// add prefilter on first run
	$J.ajaxPrefilter(function() {
		// this will be defined by the end of the script
		if (upgradeManagerPrefilter !== undefined) {
			upgradeManagerPrefilter.apply(this, arguments);
		}
	});
}

function startAutoUpgradeManager() {
	if (autoUpgradeManager) {
		console.log("UpgradeManager is already running!");
		return;
	}

	/************
	 * SETTINGS *
	 ************/
	// On each level, we check for the lane that has the highest enemy DPS.
	// Based on that DPS, if we would not be able to survive more than
	// `survivalTime` seconds, we should buy some armor.
	var survivalTime = 30;

	// Should we highlight the item we're going for next?
	var highlightNext = true;

	// Should we automatically by the next item?
	var autoBuyNext = true;

	// How many elements do you want to upgrade? If we decide to upgrade an
	// element, we'll try to always keep this many as close in levels as we
	// can, and ignore the rest.
	var elementalSpecializations = 1;

	// To estimate the overall boost in damage from upgrading an element,
	// we sort the elements from highest level to lowest, then multiply
	// each one's level by the number in the corresponding spot to get a
	// weighted average of their effects on your overall damage per click.
	// If you don't prioritize lanes that you're strongest against, this
	// will be [0.25, 0.25, 0.25, 0.25], giving each element an equal
	// scaling. However, this defaults to [0.4, 0.3, 0.2, 0.1] under the
	// assumption that you will spend much more time in lanes with your
	// strongest elements.
	var elementalCoefficients = [0.4, 0.3, 0.2, 0.1];

	// To include passive DPS upgrades (Auto-fire, etc.) we have to scale
	// down their DPS boosts for an accurate comparison to clicking. This
	// is approximately how many clicks per second we should assume you are
	// consistently doing. If you have an autoclicker, this is easy to set.
	var clickFrequency = clicksPerSecond + Math.ceil(autoClickerVariance / 2);

	/***********
	 * GLOBALS *
	 ***********/
	var scene = g_Minigame.CurrentScene();
	var waitingForUpdate = false;

	var next = {
		id: -1,
		cost: 0
	};

	var necessary = [
		{
			id: 0,
			level: 1
		}, // Light Armor
		{
			id: 11,
			level: 1
		}, // Medics
		{
			id: 2,
			level: 10
		}, // Armor Piercing Round
		{
			id: 1,
			level: 10
		}, // Auto-fire Cannon
	];

	var gAbilities = [
		11, // Medics
		13, // Good Luck Charms
		16, // Tactical Nuke
		18, // Napalm
		17, // Cluster Bomb
		14, // Metal Detector
		15, // Decrease Cooldowns
		12, // Morale Booster
	];

	var gLuckyShot = 7;
	var gElementalUpgrades = [3, 4, 5, 6]; // Fire, Water, Earth, Air

	var gHealthUpgrades = [];
	var gAutoUpgrades = [];
	var gDamageUpgrades = [];

	Object.keys(scene.m_rgTuningData.upgrades)
		.sort(function(a, b) {
			return a - b;
		}) // why is default sort string comparison
		.forEach(function(id) {
			var upgrade = scene.m_rgTuningData.upgrades[id];
			switch (upgrade.type) {
				case 0:
					gHealthUpgrades.push(+id);
					break;
				case 1:
					gAutoUpgrades.push(+id);
					break;
				case 2:
					gDamageUpgrades.push(+id);
					break;
			}
		});

	/***********
	 * HELPERS *
	 ***********/
	var getElementals = (function() {
		var cache = false;
		return function(refresh) {
			if (!cache || refresh) {
				cache = gElementalUpgrades
					.map(function(id) {
						return {
							id: id,
							level: scene.GetUpgradeLevel(id)
						};
					})
					.sort(function(a, b) {
						return b.level - a.level;
					});
			}
			return cache;
		};
	})();

	var getElementalCoefficient = function(elementals) {
		elementals = elementals || getElementals();
		return scene.m_rgTuningData.upgrades[4].multiplier *
			elementals.reduce(function(sum, elemental, i) {
				return sum + elemental.level * elementalCoefficients[i];
			}, 0);
	};

	var canUpgrade = function(id) {
		// do we even have the upgrade?
		if (!scene.bHaveUpgrade(id)) return false;

		// does it have a required upgrade?
		var data = scene.m_rgTuningData.upgrades[id];
		var required = data.required_upgrade;
		if (required !== undefined) {
			// is it at the required level to unlock?
			var level = data.required_upgrade_level || 1;
			return (level <= scene.GetUpgradeLevel(required));
		}

		// otherwise, we're good to go!
		return true;
	};

	var calculateUpgradeTree = function(id, level) {
		var data = scene.m_rgTuningData.upgrades[id];
		var boost = 0;
		var cost = 0;
		var parent;

		var cur_level = scene.GetUpgradeLevel(id);
		if (level === undefined) level = cur_level + 1;

		// for each missing level, add boost and cost
		for (var level_diff = level - cur_level; level_diff > 0; level_diff--) {
			boost += data.multiplier;
			cost += data.cost * Math.pow(data.cost_exponential_base, level - level_diff);
		}

		// recurse for required upgrades
		var required = data.required_upgrade;
		if (required !== undefined) {
			var parents = calculateUpgradeTree(required, data.required_upgrade_level || 1);
			if (parents.cost > 0) {
				boost += parents.boost;
				cost += parents.cost;
				parent = parents.required || required;
			}
		}

		return {
			boost: boost,
			cost: cost,
			required: parent
		};
	};

	var necessaryUpgrade = function() {
		var best = {
			id: -1,
			cost: 0
		};
		var wanted, id;
		while (necessary.length > 0) {
			wanted = necessary[0];
			id = wanted.id;
			if (scene.GetUpgradeLevel(id) < wanted.level) {
				best = {
					id: id,
					cost: scene.GetUpgradeCost(id)
				};
				break;
			}
			necessary.shift();
		}
		return best;
	};

	var nextAbilityUpgrade = function() {
		var best = {
			id: -1,
			cost: 0
		};
		if (autoBuyAbilities) {
			gAbilities.some(function(id) {
				if (canUpgrade(id) && scene.GetUpgradeLevel(id) < 1) {
					best = {
						id: id,
						cost: scene.GetUpgradeCost(id)
					};
					return true;
				}
			});
		}
		return best;
	};

	var bestHealthUpgrade = function() {
		var best = {
			id: -1,
			cost: 0,
			hpg: 0
		};
		var result, hpg;
		gHealthUpgrades.forEach(function(id) {
			result = calculateUpgradeTree(id);
			hpg = scene.m_rgTuningData.player.hp * result.boost / result.cost;
			if (hpg >= best.hpg) {
				if (result.required !== undefined) id = result.required;
				cost = scene.GetUpgradeCost(id);
				if (cost <= scene.m_rgPlayerData.gold || (best.cost === 0 || cost < best.cost)) { // TODO
					best = {
						id: id,
						cost: cost,
						hpg: hpg
					};
				}
			}
		});
		return best;
	};

	var bestDamageUpgrade = function() {
		var best = {
			id: -1,
			cost: 0,
			dpg: 0
		};
		var result, data, cost, dpg, boost;

		var dpc = scene.m_rgPlayerTechTree.damage_per_click;
		var base_dpc = scene.m_rgTuningData.player.damage_per_click;
		var critmult = scene.m_rgPlayerTechTree.damage_multiplier_crit;
		var unusedCritChance = getAbilityItemQuantity(18) * 0.01; // Take unused Crit items into account, since they will probably be applied soon
		var critrate = Math.min(scene.m_rgPlayerTechTree.crit_percentage + unusedCritChance, 1);
		var elementals = getElementals();
		var elementalCoefficient = getElementalCoefficient(elementals);

		// check auto damage upgrades
		gAutoUpgrades.forEach(function(id) {
			result = calculateUpgradeTree(id);
			dpg = (scene.m_rgPlayerTechTree.base_dps * result.boost / clickFrequency) / result.cost;
			if (dpg >= best.dpg) {
				if (result.required !== undefined) id = result.required;
				best = {
					id: id,
					cost: scene.GetUpgradeCost(id),
					dpg: dpg
				};
			}
		});

		// check Lucky Shot
		if (canUpgrade(gLuckyShot)) { // lazy check because prereq is necessary upgrade
			data = scene.m_rgTuningData.upgrades[gLuckyShot];
			boost = dpc * critrate * data.multiplier;
			cost = scene.GetUpgradeCost(gLuckyShot);
			dpg = boost / cost;
			if (dpg >= best.dpg) {
				best = {
					id: gLuckyShot,
					cost: cost,
					dpg: dpg
				};
			}
		}

		// check click damage upgrades
		gDamageUpgrades.forEach(function(id) {
			result = calculateUpgradeTree(id);
			dpg = base_dpc * result.boost * (critrate * critmult + (1 - critrate) * elementalCoefficient) / result.cost;
			if (dpg >= best.dpg) {
				if (result.required !== undefined) id = result.required;
				best = {
					id: id,
					cost: scene.GetUpgradeCost(id),
					dpg: dpg
				};
			}
		});

		// check elementals
		data = scene.m_rgTuningData.upgrades[4];
		var elementalLevels = elementals.reduce(function(sum, elemental) {
			return sum + elemental.level;
		}, 1);
		cost = data.cost * Math.pow(data.cost_exponential_base, elementalLevels);

		// - make new elementals array for testing
		var testElementals = elementals.map(function(elemental) {
			return {
				level: elemental.level
			};
		});
		var upgradeLevel = testElementals[elementalSpecializations - 1].level;
		testElementals[elementalSpecializations - 1].level++;
		if (elementalSpecializations > 1) {
			// swap positions if upgraded elemental now has bigger level than (originally) next highest
			var prevElem = testElementals[elementalSpecializations - 2].level;
			if (prevElem <= upgradeLevel) {
				testElementals[elementalSpecializations - 2].level = upgradeLevel + 1;
				testElementals[elementalSpecializations - 1].level = prevElem;
			}
		}

		// - calculate stats
		boost = dpc * (1 - critrate) * (getElementalCoefficient(testElementals) - elementalCoefficient);
		dpg = boost / cost;
		if (dpg > best.dpg) { // give base damage boosters priority
			// find all elements at upgradeLevel and randomly pick one
			var match = elementals.filter(function(elemental) {
				return elemental.level == upgradeLevel;
			});
			match = match[Math.floor(Math.random() * match.length)].id;
			best = {
				id: match,
				cost: cost,
				dpg: dpg
			};
		}

		return best;
	};

	var timeToDie = (function() {
		var cache = false;
		return function(refresh) {
			if (cache === false || refresh) {
				var maxHp = scene.m_rgPlayerTechTree.max_hp;
				var enemyDps = scene.m_rgGameData.lanes.reduce(function(max, lane) {
					return Math.max(max, lane.enemies.reduce(function(sum, enemy) {
						return sum + enemy.dps;
					}, 0));
				}, 0);
				cache = maxHp / (enemyDps || scene.m_rgGameData.level * 4);
			}
			return cache;
		};
	})();

	var updateNext = function() {
		next = necessaryUpgrade();
		if (next.id === -1) {
			if (timeToDie() < survivalTime) {
				next = bestHealthUpgrade();
			} else {
				var damage = bestDamageUpgrade();
				var ability = nextAbilityUpgrade();
				next = (damage.cost < ability.cost || ability.id === -1) ? damage : ability;
			}
		}
		if (next.id !== -1) {
			if (highlightNext) {
				$J('.next_upgrade').removeClass('next_upgrade');
				$J(document.getElementById('upgr_' + next.id)).addClass('next_upgrade');
			}
			if (debug) {
				console.log(
					'next buy:',
					scene.m_rgTuningData.upgrades[next.id].name,
					'(' + FormatNumberForDisplay(next.cost) + ')'
				);
			}
		}
	};

	var hook = function(base, method, func) {
		var original = method + '_upgradeManager';
		if (!base.prototype[original]) base.prototype[original] = base.prototype[method];
		base.prototype[method] = function() {
			this[original].apply(this, arguments);
			func.apply(this, arguments);
		};
	};

	/********
	 * MAIN *
	 ********/
	// ---------- JS hooks ----------
	hook(CSceneGame, 'TryUpgrade', function() {
		// if it's a valid try, we should reevaluate after the update
		if (this.m_bUpgradesBusy) {
			if (highlightNext) $J(document.body).addClass('upgrade_waiting');
			next.id = -1;
		}
	});

	hook(CSceneGame, 'ChangeLevel', function() {
		// recalculate enemy DPS to see if we can survive this level
		if (timeToDie(true) < survivalTime) updateNext();
	});

	upgradeManagerPrefilter = function(opts, origOpts, xhr) {
		if (/ChooseUpgrade/.test(opts.url)) {
			xhr
				.success(function() {
					// wait as short a delay as possible
					// then we re-run to figure out the next item to queue
					window.setTimeout(upgradeManager, 0);
				})
				.fail(function() {
					// we're desynced. wait til data refresh
					// m_bUpgradesBusy was not set to false
					scene.m_bNeedTechTree = true;
					waitingForUpdate = true;
				});
		} else if (/GetPlayerData/.test(opts.url)) {
			if (waitingForUpdate) {
				xhr.success(function(result) {
					var message = g_Server.m_protobuf_GetPlayerDataResponse.decode(result).toRaw(true, true);
					if (message.tech_tree) {
						// done waiting! no longer busy
						waitingForUpdate = false;
						scene.m_bUpgradesBusy = false;
						window.setTimeout(upgradeManager, 0);
					}
				});
			}
		}
	};

	// ---------- CSS ----------
	$J(document.body).removeClass('upgrade_waiting');
	$J('.next_upgrade').removeClass('next_upgrade');
	if (highlightNext) {
		var cssPrefix = function(property, value) {
			return '-webkit-' + property + ': ' + value + '; ' + property + ': ' + value + ';';
		};

		var css =
			'.next_upgrade { ' + cssPrefix('filter', 'brightness(1.5) contrast(2)') + ' }\n' +
			'.next_upgrade.cantafford { ' + cssPrefix('filter', 'contrast(1.3)') + ' }\n' +
			'.next_upgrade .info .name, .next_upgrade.element_upgrade .level { color: #e1b21e; }\n' +
			'#upgrades .next_upgrade .link { ' + cssPrefix('filter', 'brightness(0.8) hue-rotate(120deg)') + ' }\n' +
			'#elements .next_upgrade .link { ' + cssPrefix('filter', 'hue-rotate(120deg)') + ' }\n' +
			'.next_upgrade .cost { ' + cssPrefix('filter', 'hue-rotate(-120deg)') + ' }\n' +
			'.upgrade_waiting .next_upgrade { ' + cssPrefix('animation', 'blink 1s infinite alternate') + ' }\n' +
			'@-webkit-keyframes blink { to { opacity: 0.5; } }\n' +
			'@keyframes blink { to { opacity: 0.5; } }';

		var style = document.getElementById('upgradeManagerStyles');
		if (!style) {
			style = document.createElement('style');
			$J(style).attr('id', 'upgradeManagerStyles').appendTo('head');
		}
		$J(style).html(css);
	}

	// ---------- Timer ----------
	function upgradeManager() {
		if (debug)
			console.log('Checking for worthwhile upgrades');

		scene = g_Minigame.CurrentScene();

		// tried to buy upgrade and waiting for reply; don't do anything
		if (scene.m_bUpgradesBusy) return;

		// no item queued; refresh stats and queue next item
		if (next.id === -1) {
			if (highlightNext) $J(document.body).removeClass('upgrade_waiting');
			getElementals(true);
			timeToDie(true);
			updateNext();
		}

		// item queued; buy if we can afford it
		if (next.id !== -1 && autoBuyNext) {
			if (next.cost <= scene.m_rgPlayerData.gold) {
				var link = $J('.link', document.getElementById('upgr_' + next.id)).get(0);
				if (link) {
					scene.TryUpgrade(link);
				} else {
					console.error('failed to find upgrade');
				}
			}
		}
	}

	autoUpgradeManager = setInterval(upgradeManager, upgradeManagerFreq);

	console.log("autoUpgradeManager has been started.");
}

function stopAutoUpgradeManager() {
	if (autoUpgradeManager) {
		clearInterval(autoUpgradeManager);
		autoUpgradeManager = null;

		//Remove hooks
		var removeHook = function removeHook(base, method) {
			base.prototype[method] = (base.prototype[method + '_upgradeManager'] || base.prototype[method]);
		};

		removeHook(CSceneGame, 'TryUpgrade');
		removeHook(CSceneGame, 'ChangeLevel');

		//Clear the visual
		$J(document.body).removeClass('upgrade_waiting');
		$J('.next_upgrade').removeClass('next_upgrade');

		console.log("autoUpgradeManager has been stopped.");
	} else
		console.log("No autoUpgradeManager is running to stop.");
}


// ================ SLOW RENDERING ================
var gameOldRenderer = function() {};
function startFPSThrottle(){
	if (fpsThrottle) {
		console.log("fpsThrottling is already running!");
		return;
	}

	gameOldRenderer = g_Minigame.Render;
	var ticker = PIXI.ticker.shared;
	ticker.autoStart = false;
	ticker.stop();
	g_Minigame.Render = function() {};

	// Visual Display for peoples
	$J("#uicontainer").append('<div id="slow_fps_dialog"><div class="waiting_for_players_ctn"><div class="title_waiting">Currently in slow FPS mode to maximize performance, toggle this off in the settings if you want full FPS</div></div></div>');
	$J("#slow_fps_dialog").css({ "position": "absolute", "top": "0", "left":"0", "right":"0", "height":"100%", "background-color": "rgba(0,0,0,0.6)", "color":"white", "text-align": "center", "font-size":"12px", "z-index":"9", "padding": "10px"});


	var fpsThrottleRender = function() {
		if (!gameRunning()) return;
		m_nLastTick = false;
		g_Minigame.CurrentScene().Tick();
		requestAnimationFrame(function() { g_Minigame.Renderer.render(g_Minigame.CurrentScene().m_Container); });
	};

	// Custom render cycle
	fpsThrottle = setInterval(fpsThrottleRender, slowRenderingFreq);
	console.log("fpsThrottle has been started.");
}

function stopFPSThrottle() {
	if (fpsThrottle) {
		clearInterval(fpsThrottle);

		var ticker = PIXI.ticker.shared;
		ticker.autoStart = true;
		ticker.start();

		g_Minigame.Render = gameOldRenderer;
		g_Minigame.Render();

		$J("#slow_fps_dialog").remove();
		fpsThrottle = null;

		console.log("fpsThrottle has been stopped.");
	} else
		console.log("No fpsThrottle is running to stop.");
}


// ================ UI ELEMENTS ================
function initGUI() {
	updatePlayersInLane();
	updatePlayersInRoom();
	setInterval(function() {
		updatePlayersInLane();
		updatePlayersInRoom();
	}, 10000);
	addPointer();
	addExtraUI();

	// Overwrite this function so it doesn't delete our sexy pointer
	CSceneGame.prototype.ClearNewPlayer = function() {
		if (this.m_spriteFinger) {
			var bPlayedBefore = WebStorage.SetLocal('mg_how2click', 1);
			$J('#newplayer').hide();
		}
	};

	// Overwrite this function so our loot notifications do not repeat until we actually have a new one
	CUI.prototype.UpdateLootNotification = function() {
		if (this.m_Game.m_rgPlayerData.loot && this.m_Game.m_rgPlayerData.loot.length !== 0 && this.m_Game.m_rgGameData.level >= lastLootLevel + 10 && (lastLootCache.length === 0 || lastLootCache.toString() !== this.m_Game.m_rgPlayerData.loot.toString())) {
			$J("#loot_notification").show();
			var abilities = this.m_Game.m_rgTuningData.abilities;
			var strLootNames = "";
			for (var i = 0; i < this.m_Game.m_rgPlayerData.loot.length; ++i) {
				var loot = this.m_Game.m_rgPlayerData.loot[i];
				if (i !== 0) {
					strLootNames += ", ";
				}
				strLootNames += abilities[loot.ability].name;
			}
			$J("#loot_name").text(strLootNames);
			setTimeout(function() {
				$J("#loot_notification").fadeOut(1000);
			}, 5000);
			lastLootLevel = this.m_Game.m_rgGameData.level;
			lastLootCache = this.m_Game.m_rgPlayerData.loot;
			this.m_Game.m_rgPlayerData.loot = [];
		}
	};
}

function addPointer() {
	g_Minigame.m_CurrentScene.m_rgFingerTextures = [];
	var w = 26;
	var h = 49;

	for (var y = 0; y < 4; y++) {
		for (var x = 0; x < 5; x++) {
			g_Minigame.m_CurrentScene.m_rgFingerTextures.push(new PIXI.Texture(g_rgTextureCache.pointer.texture, {
				x: x * w,
				y: y * h,
				width: w,
				height: h
			}));
		}
	}

	g_Minigame.m_CurrentScene.m_nFingerIndex = 0;

	g_Minigame.m_CurrentScene.m_spriteFinger = new PIXI.Sprite(g_Minigame.m_CurrentScene.m_rgFingerTextures[g_Minigame.m_CurrentScene.m_nFingerIndex]);
	g_Minigame.m_CurrentScene.m_spriteFinger.scale.x = g_Minigame.m_CurrentScene.m_spriteFinger.scale.y = 2;

	g_Minigame.m_CurrentScene.m_containerParticles.addChild(g_Minigame.m_CurrentScene.m_spriteFinger);
}

function updatePlayersInLane() {
	// update players in lane
	var players = "???";
	if (g_Minigame.m_CurrentScene.m_rgLaneData[g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane])
		players = g_Minigame.m_CurrentScene.m_rgLaneData[g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane].players;

	$J("#players_in_lane").html(players);
}

function updatePlayersInRoom() {
	//Update players in room
	var players = "???";
	if (g_Minigame.m_CurrentScene.m_rgLaneData[0])
		players = (g_Minigame.m_CurrentScene.m_rgLaneData[0].players + g_Minigame.m_CurrentScene.m_rgLaneData[1].players + g_Minigame.m_CurrentScene.m_rgLaneData[2].players);
	$J("#players_in_room").html(players);
}

var endDate = initEndDate();

function initEndDate() {
	var endDate = new Date();
	if (endDate.getUTCHours() > 16) {
		endDate.setUTCDate(endDate.getUTCDate() + 1);
	}
	endDate.setUTCHours(16, 0, 0, 0);
	return endDate;
}

function updateStats() {
	var getFormattedRemainingTime = function() {
		var secondsUntilEnd = getSecondsUntilEnd();
		var hrs = Math.floor(secondsUntilEnd / 3600);
		var min = Math.floor((secondsUntilEnd - (hrs * 3600)) / 60);
		var sec = secondsUntilEnd - (hrs * 3600) - (min * 60);

		var time = '';
		if (hrs > 0) {
			if (hrs == 1) {
				time += "an hour";
			} else {
				time += hrs + " hours";
			}
			if (min > 1) {
				time += " and " + min + " minute" + (min == 1 ? '' : 's');
			}
		} else if (min > 0) {
			if (min == 1) {
				time += "a minute";
			} else {
				time += min + " minutes";
			}
			if (sec > 1) {
				time += " and " + sec + " second" + (sec == 1 ? '' : 's');
			}
		} else {
			if (sec <= 1) {
				time += "about a second";
			} else {
				time += "about " + sec + " seconds";
			}
		}
		return time;
	}

	$J('#avg_completion_rate').html(parseFloat(getSecondsPerLevel()).toFixed(2));
	$J("#estimated_end_level").html(Math.round(getSecondsUntilEnd() / getSecondsPerLevel() + g_Minigame.m_CurrentScene.m_rgGameData.level));
	$J("#remaining_time").html(getFormattedRemainingTime());
}

function addExtraUI() {
	//Add in player count for current room
	var old = $J(".title_activity").html();
	$J(".title_activity").html(old + '&nbsp;[<span id="players_in_room">0</span> in room]');
	$J("#gamecontainer").append('<div id="settings"></div>');
	$J('#settings').css({
		"position": "absolute",
		"background": "url('" + getUploadedFilePath("master/img/settings.png?v2") + "')",
		"background-repeat": "no-repeat",
		"background-position": "0px 0px",
		"height": "300px",
		"width": "500px",
		"margin-top": "2px",
		"bottom": "-65px",
		"right": "10px",
		"padding-top": "15px",
		"padding-left": "12px"
	});

	//Add replacement settings options
	$J("#settings").append('<div id="music_toggle" class="toggle"><span class="value disabled"></span><span class="title">Music: </span></div>');
	$J("#settings").append('<div id="sfx_toggle" class="toggle"><span class="value disabled"></span><span class="title">SFX: </span></div>');
	$J("#settings").append('<div id="autoclicker_toggle" class="toggle"><span class="value enabled"></span><span class="title">Auto-Clicker: </span></div>');
	$J("#settings").append('<div id="autotargetswapper_toggle" class="toggle"><span class="value enabled"></span><span class="title">Target Swapper: </span></div>');
	$J("#settings").append('<div id="autoabilityuse_toggle" class="toggle"><span class="value enabled"></span><span class="title">Ability Use: </span></div>');
	$J("#settings").append('<div id="autoconsume_toggle" class="toggle"><span class="value enabled"></span><span class="title">Consumable Use: </span></div>');
	$J("#settings").append('<div id="autoupgrade_toggle" class="toggle"><span class="value enabled"></span><span class="title">Auto Upgrader: </span></div>');
	$J("#settings").append('<div id="spamStatBoosters_toggle" class="toggle"><span class="value enabled"></span><span class="title">Spam StatBoosts: </span></div>');
	$J("#settings").append('<div id="fps_toggle" class="toggle"><span class="value disabled"></span><span class="title">FPS Limiter: </span></div>');
	$J("#settings").append('<div id="particles_toggle" class="toggle"><span class="value disabled"></span><span class="title">Particles: </span></div>');
	$J("#sfx_toggle").click(function(e) {
		e.stopPropagation();
		toggleSFX(true)
	});
	$J("#music_toggle").click(function(e) {
		e.stopPropagation();
		toggleMusic(true)
	});
	$J("#autoclicker_toggle").click(function(e) {
		e.stopPropagation();
		toggleAutoClicker()
	});
	$J("#autotargetswapper_toggle").click(function(e) {
		e.stopPropagation();
		toggleAutoTargetSwapper()
	});
	$J("#autoabilityuse_toggle").click(function(e) {
		e.stopPropagation();
		toggleAutoAbilityUser()
	});
	$J("#autoconsume_toggle").click(function(e) {
		e.stopPropagation();
		toggleAutoItemUser()
	});
	$J("#autoupgrade_toggle").click(function(e) {
		e.stopPropagation();
		toggleAutoUpgradeManager()
	});
	$J("#fps_toggle").click(function(e) {
		e.stopPropagation();
		toggleFPS()
	});
	$J("#particles_toggle").click(function(e) {
		e.stopPropagation();
		toggleSpammer()
	});
	
	$J("#spamStatBoosters_toggle").click(function(e) {
		e.stopPropagation();
		toggleSpamStatBoosters();
	});

	// We force update the icon once to sync with active settings
	toggleSFX(false);
	toggleMusic(false);

	// Slide the settings panel out on click
	$J("#settings").click(function() {
		var op = $J("#settings");
		op.animate({
			bottom: parseInt(op.css('bottom'), 10) == -65 ? -op.outerHeight() : -65
		});
	});

	//Statistics
	$J("#gamecontainer").append('<div id="statistics"></div>');
	$J('#statistics').css({
		"position": "absolute",
		"background": "url('" + getUploadedFilePath("master/img/stats.png") + "')",
		"background-repeat": "no-repeat",
		"background-position": "0px 0px",
		"height": "250px",
		"width": "500px",
		"margin-top": "2px",
		"bottom": "-65px",
		"left": "10px",
		"padding-top": "15px",
		"padding-left": "25px"
	});

	//Add in stats
	$J("#statistics").append('<div id="stat_player_dpc" class="stat"><span class="title">Dmg Per Click: </span><span class="value">0</span></div>');
	$J("#statistics").append('<div id="stat_player_dps" class="stat"><span class="title">Dmg Per Second: </span><span class="value">0</span></div>');
	$J("#statistics").append('<div id="stat_player_crit" class="stat"><span class="title">Critical Chance: </span><span class="value">0</span></div>');
	$J("#statistics").append('<div id="stat_crit_mul" class="stat"><span class="title">Critical Dmg Multiplier: </span><span class="value">0</span></div>');
	$J("#statistics").append('<div id="stat_elemental_mul" class="stat"><span class="title">Elemental Multiplier: </span><span class="value">0</span></div>');
	$J("#statistics").append('<div id="stat_elemental_dpc" class="stat"><span class="title">Elemental DPC: </span><span class="value">0</span></div>');
	$J("#statistics").append('<div id="stat_elemental_dps" class="stat"><span class="title">Elemental DPS: </span><span class="value">0</span></div>');
	$J("#statistics").append('<div id="stat_boss_loot" class="stat"><span class="title">Boss Loot Chance: </span><span class="value">0</span></div>');

	$J("#footer_spacer").css({
		"height": "175px"
	});
	$J("canvas").css({
		"position": "relative",
		"z-index": "5"
	});
	$J("#uicontainer").css({
		"z-index": "6"
	});

	//Add in IRC link
	setTimeout(function() {
		$J(".tv_ui").css({"background": "url('" + getUploadedFilePath("master/img/game_frame_tv.png") + "')"});
		$J("#info_block").append('<div id="irc_join" style="height: 30px"></div>');
		$J("#irc_join").click(function(e) {
			e.stopPropagation();
	        window.open('http://chat.mibbit.com/?channel=%23SMG_'+g_GameID+'&server=irc.mibbit.net&nick='+getUserName(),'_blank'); // Cant seem to find a local storing in js of the players username, so lets just take it from the dropdown
		});
	}, 1000);

	//Update stats
	setInterval(function() {
		function getElementalMul() {
			return Math.max(g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_air, g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_earth, g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_fire, g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_water);
		}
		$J("#statistics #stat_player_dpc .value").html(FormatNumberForDisplay(g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_per_click, 5));
		$J("#statistics #stat_player_dps .value").html(FormatNumberForDisplay(g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_per_click * clicksPerSecond, 5));
		$J("#statistics #stat_player_crit .value").html(FormatNumberForDisplay(Math.round(g_Minigame.m_CurrentScene.m_rgPlayerTechTree.crit_percentage * 100), 5) + "%");
		$J("#statistics #stat_crit_mul .value").html(FormatNumberForDisplay(g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_crit, 5) + "x");
		$J("#statistics #stat_elemental_mul .value").html(FormatNumberForDisplay(getElementalMul()) + "x");
		$J("#statistics #stat_elemental_dpc .value").html(FormatNumberForDisplay(getElementalMul() * g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_per_click, 5));
		$J("#statistics #stat_elemental_dps .value").html(FormatNumberForDisplay(getElementalMul() * g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_per_click * clicksPerSecond, 5));
		$J("#statistics #stat_boss_loot .value").html(FormatNumberForDisplay(Math.round(g_Minigame.m_CurrentScene.m_rgPlayerTechTree.boss_loot_drop_percentage * 100, 5)) + "%");
	}, 1000);

	$J("#statistics").click(function() {
		var op = $J("#statistics");
		op.animate({
			bottom: parseInt(op.css('bottom'), 10) == -65 ? -op.outerHeight() : -65
		});
	});

	//Other UI elements
	customCSS();
	addCustomButtons();
	
	// Put the page footer behind settings
	$J("#footer").css('z-index', -1);
}

function addCustomButtons() {
	//Smack the TV Easter Egg
	$J('<div style="height: 52px; position: absolute; bottom: 85px; left: 828px; z-index: 12;" onclick="SmackTV();"><br><br><span style="font-size:10px; padding: 12px; color: gold;">Smack TV</span></div>').insertBefore('#row_bottom');

	//Remove unneeded options area 
	$J(".game_options").remove();

	//Bring the close button back
	$J('<a href="http://steamcommunity.com/minigame/" class="leave_game_btn"><span style="padding-right: 50px;">Close</span><br><span style="padding-right: 50px;">Game</span></a>').insertAfter("#settings");
	$J(".leave_game_btn").css({
		"width": "120px",
		"position": "absolute",
		"bottom": "72px",
		"z-index": "12",
		"left": "340px",
		"background": "url('http://steamcommunity-a.akamaihd.net/public/images/promo/towerattack/leave_game_btn.png')",
		"background-repeat": "no-repeat",
		"background-position": "-75px 0px",
		"height": "56px",
		"float": "right",
		"margin-right": "7px",
		"padding-top": "14px",
		"cursor": "pointer",
	});
	$J('<div class="leave_game_helper">You can safely close the game or leave this screen at any time—you will continue collecting gold and damaging monsters even while away from your computer. Check back occasionally to see how you\'re doing and use in-game gold to purchase upgrades.</div>').insertAfter("#settings");
	$J(".leave_game_helper").css({
		"left": "150px",
		"top": "initial",
		"bottom": "-20px",
		"z-index": "12"
	});

	//Hide the stupid "Leave game" tooltip
	$J('.leave_game_btn').mouseover(function() {
			$J('.leave_game_helper').show();
		})
		.mouseout(function() {
			$J('.leave_game_helper').hide();
		});
	$J('.leave_game_helper').hide(); 

	// Append gameid to breadcrumbs
	var breadcrumbs = document.querySelector('.breadcrumbs');

	if (breadcrumbs) {
		var element = document.createElement('span');
		element.textContent = ' > ';
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.style.color = '#D4E157';
		element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
		element.textContent = 'Room ' + g_GameID;
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.textContent = ' > ';
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.style.color = '#F089B2';
		element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
		element.innerHTML = 'Expected Level: <span id="estimated_end_level">0</span>, Seconds Per Level <span id="avg_completion_rate">0</span>';
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.textContent = ' > ';
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.style.color = '#ACA5F2';
		element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
		element.innerHTML = 'Remaining Time: <span id="remaining_time">0 Seconds</span>.';
		breadcrumbs.appendChild(element);

		updateStats();
		setInterval(function() {
			updateStats();
		}, 10000);

		if (typeof GM_info != 'undefined') {
			element = document.createElement('span');
			element.style.cssFloat = 'right';
			element.style.color = '#D4E157';
			element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
			element.innerHTML = '<a target="_blank"  href="' + GM_info.script.namespace + '">' + GM_info.script.name + ' v' + GM_info.script.version + '</a>';
			breadcrumbs.appendChild(element);
		}
	}

}

function customCSS() {
	var css = "";
	css += "#settings .toggle { position: relative; margin-top: 10px; width: 30%; height: 32px; z-index: 0; float: left; margin-left: 10px;} ";
	css += "#settings span.title { position: relative; top: 10px; float: right; right:15px; text-align:right; width: 80%;} ";
	css += "#settings span.value { position: relative; float: right; right:10px; display: inline-block; z-index:11; cursor: pointer;} ";
	css += "#settings span.value.enabled { background: url('" + getUploadedFilePath("master/img/icons.png") + "'); background-repeat: no-repeat;background-position:0px 0px;width:30px;height:30px; } ";
	css += "#settings span.value.enabled:hover { background: url('" + getUploadedFilePath("master/img/icons.png") + "'); background-repeat: no-repeat;background-position:-30px 0px;width:30px;height:30px; } ";
	css += "#settings span.value.disabled { background: url('" + getUploadedFilePath("master/img/icons.png") + "'); background-repeat: no-repeat;background-position:0px -30px;width:30px;height:32px; } ";
	css += "#settings span.value.disabled:hover { background: url('" + getUploadedFilePath("master/img/icons.png") + "'); background-repeat: no-repeat;background-position:-30px -30px;width:30px;height:32px; } ";

	css += "#statistics .stat { position: relative; margin-top: 5px; width: 40%; height: 32px; z-index: 0; margin-left: 25px; float:left;} ";
	css += "#statistics span.value { position: relative; float: right; margin-right: 30px; text-align: right; width: 100%;} ";
	css += "#statistics span.title { position: relative; width: 100%; font-weight: bold;} ";

	css += ".toggle_btn {background: #d6d6d6;-webkit-border-radius: 7; -moz-border-radius: 7; border-radius: 7px; color: #333; text-decoration: none; text-align: center;cursor: pointer;font-weight: bold;} ";
	css += ".toggle_btn:hover { background: #85c8f2; text-decoration: none; color: #fff;cursor: pointer;font-weight: bold;} ";
	css += "#activeinlanecontainer:hover {height:auto;background:rgba(50,50,50,0.9);padding-bottom:10px;position:absolute;z-index:1} #activeinlanecontainer:hover ~ #activitylog {margin-top:97px} #activitylog {margin-top: 29px} ";
	css += "#leaderboard_wrapper {overflow: hidden; height: 360px; width: 261px; position: relative; margin: 50px 0px 0px 5px; padding: 5px;} #activeinlanecontainer:hover ~ #leaderboard_wrapper {margin-top: 118px}";
	css += "#info_hp { position:relative; top:28px; text-align: center;}";
	css += "#irc_join {position: relative; width: 175px; height: 30px; top: -50px; left: 30px; cursor: pointer;}";

	$J('head').append('<style>' + css + '</style>');
}

function updateToggle(id, enabled) {
	if (enabled) {
		$J("#" + id + "_toggle span.value").removeClass("enabled").addClass("disabled");
	} else {
		$J("#" + id + "_toggle span.value").removeClass("disabled").addClass("enabled");
	}
}

function toggleSFX(shouldToggle) {
	var enabled = WebStorage.GetLocal('minigame_mute');
	if (shouldToggle) {
		enabled = !enabled;
		WebStorage.SetLocal('minigame_mute', enabled);
	}
	updateToggle("sfx", enabled);
}

function toggleMusic(shouldToggle) {
	if (shouldToggle) {
		g_AudioManager.ToggleMusic();
	}
	updateToggle("music", WebStorage.GetLocal('minigame_mutemusic'));
}

function toggleAutoClicker() {
	if (autoClicker) {
		stopAutoClicker();
	} else {
		startAutoClicker();
	}
	updateToggle("autoclicker", !autoClicker);
}

function toggleAutoTargetSwapper() {
	if (autoTargetSwapper) {
		stopAutoTargetSwapper();
	} else {
		startAutoTargetSwapper();
	}
	updateToggle("autotargetswapper", !autoTargetSwapper);
}

function toggleAutoAbilityUser() {
	if (autoAbilityUser) {
		stopAutoAbilityUser();
	} else {
		startAutoAbilityUser();
	}
	updateToggle("autoabilityuse", !autoAbilityUser);
}

function toggleAutoItemUser() {
	if (autoUseConsumables) {
		stopAutoItemUser();
	} else {
		startAutoItemUser();
	}
	updateToggle("autoconsume", !autoUseConsumables);
}

function toggleAutoUpgradeManager() {
	if (autoUpgradeManager) {
		stopAutoUpgradeManager();
	} else {
		startAutoUpgradeManager();
	}
	updateToggle("autoupgrade", !autoUpgradeManager);
}

function toggleFPS() {
	if (fpsThrottle) {
		stopFPSThrottle();
	} else {
		startFPSThrottle();
	}
	updateToggle("fps", (fpsThrottle === null));
}

function toggleSpamStatBoosters() {
	spamStatBoosters = !spamStatBoosters;
	updateToggle("spamStatBoosters", !spamStatBoosters);
}

function spamNoClick() {
	// Save the click count
	var clickCount = g_Minigame.m_CurrentScene.m_nClicks;

	// Perform default click
	g_Minigame.m_CurrentScene.DoClick({
		data: {
			getLocalPosition: function() {
				var enemy = getTarget(),
					laneOffset = enemy.m_nLane * 440;

				return {
					x: enemy.m_Sprite.position.x - laneOffset,
					y: enemy.m_Sprite.position.y - 52
				};
			}
		}
	});

	// Restore the click count
	g_Minigame.m_CurrentScene.m_nClicks = clickCount;
}

function toggleSpammer() {
	if (spammer) {
		clearInterval(spammer);
		spammer = null;
	} else {
		if (confirm("Are you SURE you want to do this? This leads to massive memory leaks fairly quickly.")) {
			spammer = setInterval(spamNoClick, 1000 / clicksPerSecond);
		}
	}
	updateToggle("particles", (spammer == null));
}

// ================ LEADERBOARD ================
//Pulled from https://github.com/hansskogvold/steamSummerMinigame/commit/f0f905188585e367f42b756a95d459205190b14f
function initLeaderboard() {
	var container = document.createElement('div');
	container.id = 'leaderboard_wrapper';
	container.style.display = "none";

	document.getElementById('col_right').appendChild(container);

	var leaderboard = document.createElement('table');
	leaderboard.id = 'leaderboard';

	var th = document.createElement('tr');
	th.style.fontSize = '11px';
	th.style.color = '#ddd';

	var thc = document.createElement('th');
	var thn = document.createElement('th');
	var thl = document.createElement('th');
	thc.appendChild(document.createTextNode('Rank'));
	thn.appendChild(document.createTextNode('Name'));
	thl.appendChild(document.createTextNode('Level'));

	th.appendChild(thc);
	th.appendChild(thn);
	th.appendChild(thl);

	leaderboard.appendChild(th);

	document.getElementById('leaderboard_wrapper').appendChild(leaderboard);

	var credit = document.createElement('div');
	credit.style.fontSize = "12px";
	credit.style.textAlign = "center";
	credit.innerHTML = 'Data by <a href="http://steamga.me/" style="color:#ddd;" alt="http://steamga.me/" target="_blank">steamga.me</a>';

	document.getElementById('leaderboard_wrapper').appendChild(credit);

	var toggler = document.createElement('div');
	toggler.id = "leaderboard_toggler";
	toggler.onclick = function() {
		toggleLeaderboard();
	};
	toggler.style.position = 'absolute';
	toggler.style.bottom = "-48px";
	toggler.style.color = "black";
	toggler.style.textAlign = "center";
	toggler.style.width = '261px';
	toggler.style.cursor = "pointer";
	toggler.appendChild(document.createTextNode("Show Leaderboards"));

	document.getElementById('col_right').appendChild(toggler);

	getLeaderboard();

	setInterval(function() {
		getLeaderboard();
	}, 1000 * 30);
}

function drawLeaderboardRoom(room) {
	var item = document.createElement('tr');
	item.className = 'leaderboard_item';
	item.style.height = '23px';
	item.style.fontSize = '10px';

	var num = document.createElement('td');
	num.appendChild(document.createTextNode('#' + room.position));

	var name = document.createElement('td');
	name.style.textAlign = 'center';
	name.appendChild(document.createTextNode(room.name));

	var level = document.createElement('td');
	level.style.textAlign = 'right';
	level.appendChild(document.createTextNode(room.level));

	if (room.id == g_GameID) {
		item.style.color = '#d4e157';
	}

	item.appendChild(num);
	item.appendChild(name);
	item.appendChild(level);

	document.getElementById('leaderboard').appendChild(item);
}

function getLeaderboard() {
	GM_xmlhttpRequest({
		method: "GET",
		url: "http://steamga.me/data/api/leaderboard.json",
		onload: function(response) {
			console.log('Downloading new leaderboard...');
			var elements = document.getElementsByClassName('leaderboard_item');
			while (elements.length > 0) {
				elements[0].parentNode.removeChild(elements[0]);
			}
			var resp = JSON.parse(response.responseText);
			var leaderboard = Object.keys(resp).map(function(key) {
				return resp[key]
			});
			leaderboard.sort(function(a, b) {
				return b.level - a.level;
			});
			leaderboard.map(function(room) {
				drawLeaderboardRoom(room);
			});
		}
	});
}

function toggleLeaderboard() {
	var a = document.getElementById('leaderboard_wrapper');
	var b = document.getElementById('activitylog');
	var c = document.getElementById('leaderboard_toggler');
	if (a.style.display == 'block') {
		a.style.display = 'none';
		b.style.display = 'block';
		c.innerHTML = "Show Leaderboards";
	} else {
		a.style.display = 'block';
		b.style.display = 'none';
		c.innerHTML = "Show Activity";
	}
}

// ================ UTILS================
function getSecondsUntilEnd() {
	return (endDate.getTime() / 1000) - g_Minigame.m_CurrentScene.m_nTime;
}

function getSecondsPerLevel() {
	return ((g_Minigame.m_CurrentScene.m_rgGameData.timestamp - g_Minigame.m_CurrentScene.m_rgGameData.timestamp_game_start) / g_Minigame.m_CurrentScene.m_rgGameData.level)
}

function hasTimeLeftToUseConsumable(id, ignoreBuffer) {
	if(ignoreBuffer)
		return getSecondsUntilEnd() <= (getAbilityItemQuantity(id) * abilityCooldown(id));
	else
		return getSecondsUntilEnd() <= ((getAbilityItemQuantity(id) * abilityCooldown(id)) + minutesBufferForConsumableDump * 60);
}
	
function getEstimatedLevelsLeft() {
	return getSecondsUntilEnd() / getSecondsPerLevel();
}
function castAbility(abilityID) {
	if (hasAbility(abilityID)) {
		if (abilityID <= ABILITIES.NAPALM && document.getElementById('ability_' + abilityID) !== null)
			g_Minigame.CurrentScene().TryAbility(document.getElementById('ability_' + abilityID).childElements()[0]);
		else if (document.getElementById('abilityitem_' + abilityID) !== null)
			g_Minigame.CurrentScene().TryAbility(document.getElementById('abilityitem_' + abilityID).childElements()[0]);
	}
}

function currentLaneHasAbility(abilityID) {
	return laneHasAbility(g_Minigame.CurrentScene().m_rgPlayerData.current_lane, abilityID);
}

function laneHasAbility(lane, abilityID) {
	try {
		if (g_Minigame.m_CurrentScene.m_rgLaneData[lane].abilities[abilityID])
			return g_Minigame.m_CurrentScene.m_rgLaneData[lane].abilities[abilityID];
		else
			return 0;
	} catch (e) {
		return 0;
	}
}

function abilityIsUnlocked(abilityID) {
	if (abilityID <= ABILITIES.NAPALM)
		return ((1 << abilityID) & g_Minigame.CurrentScene().m_rgPlayerTechTree.unlocked_abilities_bitfield) > 0;
	else
		return getAbilityItemQuantity(abilityID) > 0;
}

function getAbilityItemQuantity(abilityID) {
	for (var i = 0; i < g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items.length; ++i) {
		var abilityItem = g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items[i];

		if (abilityItem.ability == abilityID)
			return abilityItem.quantity;
	}

	return 0;
}

// Ability cooldown time remaining (in seconds)
function abilityCooldown(abilityID) {
	return g_Minigame.CurrentScene().GetCooldownForAbility(abilityID);
}

// thanks to /u/mouseasw for the base code: https://github.com/mouseas/steamSummerMinigame/blob/master/autoPlay.js
function hasAbility(abilityID) {
	// each bit in unlocked_abilities_bitfield corresponds to an ability.
	// the above condition checks if the ability's bit is set or cleared. I.e. it checks if
	// the player has purchased the specified ability.
	return abilityIsUnlocked(abilityID) && abilityCooldown(abilityID) <= 0;
}

function updateUserElementMultipliers() {
	if (!gameRunning() || !g_Minigame.m_CurrentScene.m_rgPlayerTechTree) return;

	userElementMultipliers[3] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_air;
	userElementMultipliers[4] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_earth;
	userElementMultipliers[1] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_fire;
	userElementMultipliers[2] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_water;

	userMaxElementMultiiplier = Math.max.apply(null, userElementMultipliers);
}

// Return a value to compare mobs' priority (lower value = less important)
//  (treasure > boss > miniboss > spawner > creep)
function getMobTypePriority(potentialTarget) {

	if (!potentialTarget || !potentialTarget.m_data)
		return -1;

	mobType = potentialTarget.m_data.type;

	switch (mobType) {
		case 1: // Creep
			return 0;
		case 0: // Spawner
			return 1;
		case 3: // Miniboss
			return 2;
		case 2: // Boss
			return 3;
		case 4: // Treasure
			return 4;
		case false: // Let's just assume false is a flag for most important
			return 4;
		default:
			return -1;
	}
}

// Compares two mobs' priority. Returns a negative number if A < B, 0 if equal, positive if A > B
function compareMobPriority(mobA, mobB) {
	if (!mobA)
		return false;
	if (!mobB) {
		swapReason = "Swapping off a non-existent mob.";
		return true;
	}

	var percentHPRemaining = g_Minigame.CurrentScene().m_rgPlayerData.hp / g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp * 100;
	var aHasHealing = laneHasAbility(mobA.m_nLane, ABILITIES.MEDICS) || laneHasAbility(mobA.m_nLane, ABILITIES.STEAL_HEALTH);
	var bHasHealing = laneHasAbility(mobB.m_nLane, ABILITIES.MEDICS) || laneHasAbility(mobB.m_nLane, ABILITIES.STEAL_HEALTH);

	var aIsGold = laneHasAbility(mobA.m_nLane, ABILITIES.RAINING_GOLD);
	var bIsGold = laneHasAbility(mobB.m_nLane, ABILITIES.RAINING_GOLD);

	var aTypePriority = getMobTypePriority(mobA);
	var bTypePriority = getMobTypePriority(mobB);

	var aElemMult = userElementMultipliers[g_Minigame.m_CurrentScene.m_rgGameData.lanes[mobA.m_nLane].element];
	var bElemMult = userElementMultipliers[g_Minigame.m_CurrentScene.m_rgGameData.lanes[mobB.m_nLane].element];

	//check for Max Elemental Damage Ability
	if (laneHasAbility(mobA.m_nLane, ABILITIES.MAX_ELEMENTAL_DAMAGE))
		aElemMult = userMaxElementMultiiplier;
	if (laneHasAbility(mobB.m_nLane, ABILITIES.MAX_ELEMENTAL_DAMAGE))
		bElemMult = userMaxElementMultiiplier;

	var aHP = mobA.m_data.hp;
	var bHP = mobB.m_data.hp;

	//First, make sure they're alive
	if (mobA.m_bIsDestroyed || aHP <= 0)
		return false;
	else if (mobB.m_bIsDestroyed || bHP <= 0) {
		swapReason = "Swapping off a destroyed mob.";
		return true;
	}

	//ignore in the weird case that mob priority isn't set to any type (usually set to 'false') (I've seen it sometimes)
	/*if(aTypePriority !== -1) {
		//if(debug)
		//	console.log('wtf, unknown mobType.', [mobA.m_nLane, mobA.m_nID, aTypePriority], [mobB.m_nLane, mobB.m_nID, bTypePriority]);
		return false;
	}
	else if(bTypePriority !== -1)
		return true;
	*/
	else if (aIsGold != bIsGold) {
		if (aIsGold > bIsGold && (mobB.m_data.type == 3 || mobB.m_data.type == 1)) {
			swapReason = "Switching to target with Raining Gold.";
			return true;
		}
	} else if (aTypePriority != bTypePriority) {
		if (aTypePriority > bTypePriority) {
			swapReason = "Switching to higher priority target.";
			return true;
		}
	}

	//Run to a medic lane if needed
	else if (percentHPRemaining <= seekHealingPercent && !g_Minigame.m_CurrentScene.m_bIsDead) {
		if (aHasHealing != bHasHealing) {
			if (aHasHealing) {
				swapReason = "Swapping to lane with active healing.";
				return true;
			}
		}
	} else if (aElemMult != bElemMult) {
		if (aElemMult > bElemMult) {
			swapReason = "Switching to elementally weaker target.";
			return true;
		}
	} else if (aHP != bHP) {
		if (aHP < bHP) {
			swapReason = "Switching to lower HP target.";
			return true;
		}
	}
	return false;
}

function getTarget() {
	try {
		var target = g_Minigame.m_CurrentScene.GetEnemy(g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane, g_Minigame.m_CurrentScene.m_rgPlayerData.target);
		return target;
	} catch (e) {
		return null;
	}
}

function gameRunning() {
	try {
		return (typeof g_Minigame === "object" && g_Minigame.m_CurrentScene.m_rgGameData.status == 2);
	} catch (e) {
		return false;
	}
}

function getUploadedFilePath(fileName) {
	if (typeof GM_info != 'undefined') {
		return GM_info.script.namespace.replace("github", "raw.githubusercontent") + "/" + fileName;
	} else return "https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/"+fileName;
}

function subLong(x, y) {
    var addLong = function(x, y) {
        var s = '';
        if (y.length > x.length) {
            s = x;
            x = y;
            y = s;
        }
        s = (parseInt(x.slice(-9),10) + parseInt(y.slice(-9),10)).toString();
        x = x.slice(0,-9); 
        y = y.slice(0,-9);
        if (s.length > 9) {
            if (x === '') return s;
            x = addLong(x, '1');
            s = s.slice(1);
        } else if (x.length) { while (s.length < 9) { s = '0' + s; } }
        if (y === '') return x + s;
        return addLong(x, y) + s; 
    }
    var s;
    s = (parseInt('1'+x.slice(-9),10) - parseInt(y.slice(-9),10)).toString(); 
    x = x.slice(0,-9);
    y = y.slice(0,-9);
    if (s.length === 10 || x === '') {
        s = s.slice(1);
    } else { 
        if (y.length) { y = addLong(y, '1'); } 
        else { y = '1';}
        if (x.length) { while (s.length < 9) { s = '0' + s; }}
    }
    if (y === '') { 
        s = (x + s).replace(/^0+/,'');
        return s;
    }
    return subLong(x, y) + s;
}

function getAccountId(id) {
    return parseInt(subLong(''+id, '76561197960265728'));
}

function getUserName() {
	if (g_Minigame.m_CurrentScene.m_rgPlayerNameCache) {
		return g_Minigame.m_CurrentScene.m_rgPlayerNameCache[getAccountId(g_steamID)];
	}
	return "Unknown";
}

function getGameLevel() {
	return g_Minigame.m_CurrentScene.m_rgGameData.level + 1;
}

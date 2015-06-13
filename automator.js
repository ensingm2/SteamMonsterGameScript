// ==UserScript== 
// @name Steam Monster Game Script
// @namespace https://github.com/ensingm2/SteamMonsterGameScript
// @description A Javascript automator for the 2015 Summer Steam Monster Minigame
// @version 1.01
// @match http://steamcommunity.com/minigame/towerattack*
// @updateURL https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/automator.js
// @downloadURL https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/automator.js
// ==/UserScript==

// Compiled and customized by reddit user /u/therusher
// Credit to reddit users /u/leandr0c, /u/nbadal and /u/kolodz for additional code

// Custom variables
var debug = false;
var clicksPerSecond = 50;
var autoClickerVariance = Math.floor(clicksPerSecond / 10);
var respawnCheckFreq = 5000;
var targetSwapperFreq = 1000;
var abilityUseCheckFreq = 2000;
var itemUseCheckFreq = 5000;

//item use variables
var useMedicsAtPercent = 30;
var useNukeOnSpawnerAbovePercent = 75;
var useMetalDetectorOnBossBelowPercent = 30;

// You shouldn't need to ever change this, you only push to server every 1s anyway
var autoClickerFreq = 1000;

// Internal variables, you shouldn't need to touch these
var autoRespawner, autoClicker, autoTargetSwapper, autoTargetSwapperElementUpdate, autoAbilityUser, autoItemUser;
var userElementMultipliers = [1, 1, 1, 1];

// ================ STARTER FUNCTIONS ================
function startAutoClicker() {
	if(autoClicker) {
		console.log("Autoclicker is already running!");
		return;
	}

	autoClicker = setInterval( function(){
		//Vary the number of clicks by up to the autoClickerVariance variable (plus or minus)
		var randomVariance = Math.floor(Math.random() * autoClickerVariance * 2) - (autoClickerVariance);
		var clicks = clicksPerSecond + randomVariance;
		
		//Set the variable to be sent to the server
		g_Minigame.m_CurrentScene.m_nClicks = clicks;

		if(debug)
			console.log('Clicking ' + clicks + ' times this second.');
	}, autoClickerFreq);

	console.log("autoClicker has been started.");
}

function startAutoRespawner() {
	if(autoRespawner) {
		console.log("autoRespawner is already running!");
		return;
	}
	
	autoRespawner = setInterval( function(){
		if(debug)
			console.log('Checking if the player is dead.');

		
		// Credit to /u/kolodz for base code. http://www.reddit.com/r/SteamMonsterGame/comments/39joz2/javascript_auto_respawn/
		if(g_Minigame.m_CurrentScene.m_bIsDead) {
			if(debug)
				console.log('Player is dead. Respawning.');

			RespawnPlayer();
		}
	}, respawnCheckFreq);
	
	console.log("autoRespawner has been started.");
}

function startAutoTargetSwapper() {
	if(autoTargetSwapper) {
		console.log("autoTargetSwapper is already running!");
		return;
	}

	//Update the user's element multipliers every 30s
	updateUserElementMultipliers();
	autoTargetSwapperElementUpdate = setInterval(updateUserElementMultipliers, 30000);
	
	autoTargetSwapper = setInterval(function() {
		var currentTarget = g_Minigame.m_CurrentScene.m_rgEnemies[g_Minigame.m_CurrentScene.m_rgPlayerData.target];
        var newTarget = currentTarget;
		var newTargetIsGold = false;
		var newTargetElement = -1;
		
		
        g_Minigame.m_CurrentScene.m_rgEnemies.each(function(testMob){
			
			var setTarget = false;
			var testMobIsGold = g_Minigame.m_CurrentScene.m_rgLaneData[testMob.m_nLane].abilities[17];
			var testMobElement = g_Minigame.m_CurrentScene.m_rgGameData.lanes[testMob.m_nLane].element;
			
			//Do nothing if already selected
			if(testMob == currentTarget || testMob == newTarget) {}
			
			//No target yet
			else if(newTarget == undefined)
				setTarget = true;
			
			//check for raining gold above all else (ability 17)
			else if(testMobIsGold && !newTargetIsGold) {
				if(debug)
					console.log('Switching lanes for Raining Gold!');
				setTarget = true
			}
			
			//different type, prioritize by type (treasure > boss > miniboss > spawner > creep)
			// 0 - Spawner
			// 1 - Creeps
			// 2 - Boss
			// 3 - MiniBoss
			// 4 - Treasure Mob
			//(why are the types so disorganized?)
			else if(testMob.m_data.type != newTarget.m_data.type) {
				
				// Treasure Mob
				if(testMob.m_data.type == 4)
					setTarget = true;
				
				//Boss (?)
				else if(testMob.m_data.type == 2 && newTarget.m_data.type != 3 && newTarget.m_data.type != 0 )
					setTarget = true;
				
				//MiniBoss (?)
				if(testMob.m_data.type == 3 && newTarget.m_data.type < 2)
					setTarget = true;
				
				// Spawner
				else if(testMob.m_data.type == 0)
					setTarget = true;
				
				if(setTarget && debug)
					console.log('Switching to a higher priority mob type.');
				
				//Creeps should never be targeted by this block
			}
			
			//Same type, prioritize by element
			else if(newTargetElement != testMobElement) {
				if(userElementMultipliers[newTargetElement] < userElementMultipliers[testMobElement]) {
					setTarget = true;
					if(debug)
						console.log('Switching to a lane with elemental weakness.');
				}
			}
			
			
			//Same type & element, prioritize by health remaining
			else if(newTarget.m_data.hp > testMob.m_data.hp) {
				setTarget = true;
				
				if(debug)
					console.log('Switching to a lower health target.');
			}
			
			//If needed, overwrite the new target to the mob
			if(setTarget){
				newTarget = testMob;
				newTargetIsGold = g_Minigame.m_CurrentScene.m_rgLaneData[newTarget.m_nLane].abilities[17];
				newTargetElement = g_Minigame.m_CurrentScene.m_rgGameData.lanes[newTarget.m_nLane].element;
			}
        });
		
		//Switch to that target
		if(newTarget != currentTarget){
			if(g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != newTarget.m_nLane)
				g_Minigame.m_CurrentScene.TryChangeLane(newTarget.m_nLane);
			g_Minigame.m_CurrentScene.TryChangeTarget(newTarget.m_nID);
		}
	}, targetSwapperFreq);
	
	console.log("autoTargetSwapper has been started.");
}

function startAutoAbilityUser() {
	if(autoAbilityUser) {
		console.log("autoAbilityUser is already running!");
		return;
	}

	autoAbilityUser = setInterval(function() {
		if(debug)
			console.log("Checking if it's useful to use an ability.");
		
		var percentHPRemaining = g_Minigame.m_CurrentScene.m_rgPlayerData.hp  / g_Minigame.m_CurrentScene.m_rgPlayerTechTree.max_hp * 100;
		var target = g_Minigame.m_CurrentScene.m_rgEnemies[g_Minigame.m_CurrentScene.m_rgPlayerData.target];
		var targetPercentHPRemaining;
		if(target)
			targetPercentHPRemaining = target.m_data.hp  / target.m_data.max_hp * 100;
		
		// Morale Booster
		if(hasAbility(5)) { 
			// TODO: Implement this
		}
		
		// Good Luck Charm
		if(hasAbility(6)) { 
			// TODO: Implement this
		}
		
		// Medics
		if(percentHPRemaining <= useMedicsAtPercent && !g_Minigame.m_CurrentScene.m_bIsDead) {
			if(debug)
				console.log("Health below threshold. Need medics!");
			
			// TODO: Only use if there isn't already a Medics active?
			if(hasAbility(7)) {
				if(debug)
					console.log("Unleash the medics!");
				castAbility(7);
			}
			else if(debug)
				console.log("No medics to unleash!");
		}
	
		// Metal Detector
		if(target != undefined && target.m_data.type == 2 && targetPercentHPRemaining <= useMetalDetectorOnBossBelowPercent) {
			if(hasAbility(8)) {
				if(debug)
					console.log('Using Metal Detector.');
				
				castAbility(8);
			}
			
		}
		
		// Decrease Cooldowns (doesn't stack, so make sure it's not already active)
		if(hasAbility(9) && !currentLaneHasAbility(9)) { 
			// TODO: Any logic to using this?
			if(debug)
				console.log('Decreasing cooldowns.');
			
			castAbility(9);
		}
		
		// Tactical Nuke
		if(target != undefined && target.m_data.type == 0 && targetPercentHPRemaining >= useNukeOnSpawnerAbovePercent) {
			if(hasAbility(10)) {
				if(debug)
					console.log('Nuclear launch detected.');
				
				castAbility(10);
			}
			
		}
		
		// Cluster Bomb
		if(hasAbility(11)) { 
			// TODO: Implement this
		}
		
		// Napalm
		if(hasAbility(12)) { 
			// TODO: Implement this
		}
		
	}, abilityUseCheckFreq);
	
	console.log("autoAbilityUser has been started.");
}

function startAutoItemUser() {
	if(autoItemUser) {
		console.log("autoItemUser is already running!");
		return;
	}

	autoItemUser = setInterval(function() {
		if(debug)
			console.log("Checking if it's useful to use an item.");
		
		// TODO: Implement This
		
	}, itemUseCheckFreq);
	
	console.log("autoItemUser has been started.");
}

function startAllAutos() {
	startAutoClicker();
	startAutoRespawner();
	startAutoTargetSwapper();
	startAutoAbilityUser();
	startAutoItemUser();
}

// ================ STOPPER FUNCTIONS ================
function stopAutoClicker() {
	if(autoClicker) {
		clearInterval(autoClicker);
		autoClicker = null;
		console.log("autoClicker has been stopped.");
	}
	else
		console.log("No autoClicker is running to stop.");
}
function stopAutoRespawner() {
	if(autoRespawner) {
		clearInterval(autoRespawner);
		autoRespawner = null;
		console.log("autoRespawner has been stopped.");
	}
	else
		console.log("No autoRespawner is running to stop.");
		
}
function stopAutoTargetSwapper() {
	if(autoTargetSwapper){
		clearInterval(autoTargetSwapper);
		autoTargetSwapper = null;
		console.log("autoTargetSwapper has been stopped.");
	}
	else
		console.log("No autoTargetSwapper is running to stop.");
}
function stopAutoAbilityUser() {
	if(autoAbilityUser){
		clearInterval(autoAbilityUser);
		autoAbilityUser = null;
		console.log("autoAbilityUser has been stopped.");
	}
	else
		console.log("No autoAbilityUser is running to stop.");
}
function stopAutoItemUser() {
	if(autoItemUser){
		clearInterval(autoItemUser);
		autoItemUser = null;
		console.log("autoItemUser has been stopped.");
	}
	else
		console.log("No autoItemUser is running to stop.");
}

function stopAllAutos() {
	stopAutoClicker();
	stopAutoRespawner();
	stopAutoTargetSwapper();
	stopAutoAbilityUser();
	stopAutoItemUser();
}

function disableAutoNukes() {
	useNukeOnSpawnerAbovePercent = 200;
	console.log('Automatic nukes have been disabled');
}

// ================ HELPER FUNCTIONS ================
function castAbility(abilityID) {
	if(hasAbility(abilityID))
		g_Minigame.m_CurrentScene.TryAbility(document.getElementById('ability_' + abilityID).childElements()[0]);
}

function currentLaneHasAbility(abilityID) {
	return g_Minigame.m_CurrentScene.m_rgLaneData[g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane].abilities[abilityID];
}

// thanks to /u/mouseasw for the base code: https://github.com/mouseas/steamSummerMinigame/blob/master/autoPlay.js
function hasAbility(abilityID) {
	// each bit in unlocked_abilities_bitfield corresponds to an ability.
	// the above condition checks if the ability's bit is set or cleared. I.e. it checks if
	// the player has purchased the specified ability.
	return ((1 << abilityID) & g_Minigame.m_CurrentScene.m_rgPlayerTechTree.unlocked_abilities_bitfield) && g_Minigame.m_CurrentScene.GetCooldownForAbility(abilityID) <= 0;
}

function updateUserElementMultipliers() {
	userElementMultipliers[0] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_air;
	userElementMultipliers[1] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_earth;
	userElementMultipliers[2] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_fire;
	userElementMultipliers[3] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_water;
}

//Expose functions if running in userscript
if(typeof unsafeWindow != 'undefined') {
	unsafeWindow.startAutoClicker = startAutoClicker;
	unsafeWindow.startAutoRespawner = startAutoRespawner;
	unsafeWindow.startAutoTargetSwapper = startAutoTargetSwapper;
	unsafeWindow.startAutoAbilityUser = startAutoAbilityUser;
	unsafeWindow.startAutoItemUser = startAutoItemUser;
	unsafeWindow.startAllAutos = startAllAutos;
	unsafeWindow.stopAutoClicker = stopAutoClicker;
	unsafeWindow.stopAutoRespawner = stopAutoRespawner;
	unsafeWindow.stopAutoTargetSwapper = stopAutoTargetSwapper;
	unsafeWindow.stopAutoAbilityUser = stopAutoAbilityUser;
	unsafeWindow.stopAutoItemUser = stopAutoItemUser;
	unsafeWindow.stopAllAutos = stopAllAutos;
	unsafeWindow.disableAutoNukes = disableAutoNukes;
	unsafeWindow.castAbility = castAbility;
	unsafeWindow.hasAbility = hasAbility;
}

//Start all autos
startAllAutos();

// ==UserScript== 
// @name Steam Monster Game Script
// @namespace https://github.com/ensingm2/SteamMonsterGameScript
// @description A Javascript automator for the 2015 Summer Steam Monster Minigame
// @version 1.06
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
var seekHealingPercent = 20;

//item use variables
var useMedicsAtPercent = 30;
var useNukeOnSpawnerAbovePercent = 75;
var useMetalDetectorOnBossBelowPercent = 30;

// You shouldn't need to ever change this, you only push to server every 1s anyway
var autoClickerFreq = 1000;

// Internal variables, you shouldn't need to touch these
var autoRespawner, autoClicker, autoTargetSwapper, autoTargetSwapperElementUpdate, autoAbilityUser, autoItemUser;
var elementUpdateRate = 60000;
var userElementMultipliers = [1, 1, 1, 1];
var userMaxElementMultiiplier = 1;
var swapReason;

// ================ STARTER FUNCTIONS ================
function startAutoClicker() {
	if(autoClicker) {
		console.log("Autoclicker is already running!");
		return;
	}

	autoClicker = setInterval( function(){
		if(!gameRunning()) return;

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
		if(!gameRunning()) return;
		
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

	updateUserElementMultipliers();
	autoTargetSwapperElementUpdate = setInterval(updateUserElementMultipliers, elementUpdateRate);
	
	autoTargetSwapper = setInterval(function() {
		if(!gameRunning()) return;
		
			
		var currentTarget = null;
		g_Minigame.m_CurrentScene.m_rgEnemies.each(function(potentialTarget){
				if(currentTarget == null || compareMobPriority(potentialTarget, currentTarget) > 0) {
					currentTarget = potentialTarget;
				}
		});
			
		//Switch to that target
		if(currentTarget != null && currentTarget != g_Minigame.m_CurrentScene.m_rgEnemies[g_Minigame.m_CurrentScene.m_rgPlayerData.target]) {
			if(debug) {
				console.log("switching targets");
				console.log(swapReason);
			}
			
			if(g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != currentTarget.m_nLane)
				g_Minigame.m_CurrentScene.TryChangeLane(currentTarget.m_nLane);
			g_Minigame.m_CurrentScene.TryChangeTarget(currentTarget.m_nID);
		}
		//Move back to lane if still targetting
		else if(currentTarget != null && currentTarget == currentTarget && g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != currentTarget.m_nLane) {
			g_Minigame.m_CurrentScene.TryChangeLane(currentTarget.m_nLane);
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
		if(!gameRunning()) return;
		
		if(debug)
			console.log("Checking if it's useful to use an ability.");
		
		var percentHPRemaining = g_Minigame.CurrentScene().m_rgPlayerData.hp  / g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp * 100;
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
		if(!gameRunning()) return;
		
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
		g_Minigame.CurrentScene().TryAbility(document.getElementById('ability_' + abilityID).childElements()[0]);
}

function currentLaneHasAbility(abilityID) {
	return g_Minigame.m_CurrentScene.m_rgLaneData[g_Minigame.CurrentScene().m_rgPlayerData.current_lane].abilities[abilityID];
}

// thanks to /u/mouseasw for the base code: https://github.com/mouseas/steamSummerMinigame/blob/master/autoPlay.js
function hasAbility(abilityID) {
	// each bit in unlocked_abilities_bitfield corresponds to an ability.
	// the above condition checks if the ability's bit is set or cleared. I.e. it checks if
	// the player has purchased the specified ability.
	return ((1 << abilityID) & g_Minigame.CurrentScene().m_rgPlayerTechTree.unlocked_abilities_bitfield) && g_Minigame.CurrentScene().GetCooldownForAbility(abilityID) <= 0;
}

function updateUserElementMultipliers() {
	if(!gameRunning()) return;
	
	userElementMultipliers[0] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_air;
	userElementMultipliers[1] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_earth;
	userElementMultipliers[2] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_fire;
	userElementMultipliers[3] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_water;
	
	userMaxElementMultiiplier = Math.max.apply(null, userElementMultipliers);
 }

// Return a value to compare mobs' priority (lower value = less important)
//  (treasure > boss > miniboss > spawner > creep)
function getMobTypePriority(potentialTarget) {
	mobType = potentialTarget.m_data.type;
	switch(mobType) {
		case 0: // Spawner
			return 0;
		case 3: // Miniboss
			return 1;
		case 2: // Boss
			return 2;
		case 4: // Treasure
			return 3;
	}
	return -Number.MAX_VALUE;
}

// Compares two mobs' priority. Returns a negative number if A < B, 0 if equal, positive if A > B
function compareMobPriority(mobA, mobB) {
	var percentHPRemaining = g_Minigame.CurrentScene().m_rgPlayerData.hp  / g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp * 100;
	var aHasHealing = g_Minigame.m_CurrentScene.m_rgLaneData[mobA.m_nLane].abilities[7];
	var bHasHealing = g_Minigame.m_CurrentScene.m_rgLaneData[mobB.m_nLane].abilities[7];

	var aIsGold = g_Minigame.m_CurrentScene.m_rgLaneData[mobA.m_nLane].abilities[17];
	var bIsGold = g_Minigame.m_CurrentScene.m_rgLaneData[mobB.m_nLane].abilities[17];
	
	var aTypePriority = getMobTypePriority(mobA);
	var bTypePriority = getMobTypePriority(mobB);
	
	var aElemMult = userElementMultipliers[g_Minigame.m_CurrentScene.m_rgGameData.lanes[mobA.m_nLane].element];
	var bElemMult = userElementMultipliers[g_Minigame.m_CurrentScene.m_rgGameData.lanes[mobB.m_nLane].element];

	//check for Max Elemental Damage Ability
	if(g_Minigame.m_CurrentScene.m_rgLaneData[mobA.m_nLane].abilities[16])
		aElemMult = userMaxElementMultiiplier;
	if(g_Minigame.m_CurrentScene.m_rgLaneData[mobB.m_nLane].abilities[16])
		bElemMult = userMaxElementMultiiplier;
	
	
	var aHP = mobA.m_data.hp;
	var bHP = mobB.m_data.hp;

	if(percentHPRemaining <= seekHealingPercent && !g_Minigame.m_CurrentScene.m_bIsDead) {
		if(aHasHealing != bHasHealing) {
			swapReason = "Swapping to lane with active healing.";

			return (aHasHealing ? 1 : -1);
		}
	}

	if(aIsGold != bIsGold) {		
		swapReason = "Switching to target with Raining Gold.";
		
		return (aIsGold ? 1 : -1);
	}
	if(aTypePriority != bTypePriority) {
		swapReason = "Switching to higher priority target.";
		
		return aTypePriority - bTypePriority;
	}
	if(aElemMult != bElemMult) {
		swapReason = "Switching to elementally weaker target.";
		
		return aElemMult - bElemMult;
	}
	if(aHP != bHP) {
		swapReason = "Switching to lower HP target.";
		
		return aHP - bHP;
	}
	return 0;
}

function gameRunning() {
	return typeof g_Minigame === "object";
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

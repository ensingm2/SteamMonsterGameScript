// ==UserScript== 
// @name Steam Monster Game Script
// @namespace https://github.com/ensingm2/SteamMonsterGameScript
// @description A Javascript automator for the 2015 Summer Steam Monster Minigame
// @version 1.18
// @match http://steamcommunity.com/minigame/towerattack*
// @updateURL https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/automator.js
// @downloadURL https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/automator.js
// ==/UserScript==

// Compiled and customized by reddit user /u/therusher
// Credit to reddit users /u/leandr0c, /u/nbadal and /u/kolodz for additional code

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
var upgradeManagerFreq = 30000;

//item use variables
var useMedicsAtPercent = 30;
var useNukeOnSpawnerAbovePercent = 75;
var useMetalDetectorOnBossBelowPercent = 30;
var useStealHealthAtPercent = 15;

// You shouldn't need to ever change this, you only push to server every 1s anyway
var autoClickerFreq = 1000;

// Internal variables, you shouldn't need to touch these
var autoRespawner, autoClicker, autoTargetSwapper, autoTargetSwapperElementUpdate, autoAbilityUser, autoItemUser, autoUpgradeManager;
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
		
		// Set the variable to be sent to the server
		g_Minigame.m_CurrentScene.m_nClicks = clicks;
		
		// Anti-anti-clicker countermeasure
		g_msTickRate = 1100;

		//Clear out the crits
		var numCrits =  g_Minigame.m_CurrentScene.m_rgStoredCrits.length;
		g_Minigame.m_CurrentScene.m_rgStoredCrits = [];
		
		if(debug) {
			if(numCrits > 1)
				console.log('Clicking ' + clicks + ' times this second. (' + numCrits + ' crits).');
			if(numCrits == 1)
				console.log('Clicking ' + clicks + ' times this second. (1 crit).');
			else
				console.log('Clicking ' + clicks + ' times this second.');
			
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

function startAutoUpgradeManager() {
	if( autoUpgradeManager ) {
		console.log("UpgradeManager is already running!");
		return;
	}
	
	autoUpgradeManager = setInterval(function() {
		if(debug)
			console.log('Checking for worthwhile upgrades');
	  /************
	   * SETTINGS *
	   ************/
	  // On each level, we check for the lane that has the highest enemy DPS.
	  // Based on that DPS, if we would not be able to survive more than
	  // `survivalTime` seconds, we should buy some armor.
	  var survivalTime = 30;

	  // To estimate the overall boost in damage from upgrading an element,
	  // we multiply the damage gained for just that element by this number.
	  // By default this is 25% under the assumption that each element is
	  // targeted with the same chance. However, if your playstyle (or auto
	  // clicker) focuses more on elements you're strong against, you can
	  // increase this number. Note that there's about a 58% chance of any
	  // single element to appear on a level, so I wouldn't recommend setting
	  // this higher than about 0.6 at most.
	  var elementalCoefficient = 0.35;

	  // How many elements do you want to upgrade? If we decide to upgrade an
	  // element, we'll try to always keep this many as close in levels as we
	  // can, and ignore the rest.
	  var elementalSpecializations = 2;

	  // To include passive DPS upgrades (Auto-fire, etc.) we have to scale
	  // down their DPS boosts for an accurate comparison to clicking. This
	  // is approximately how many clicks per second we should assume you are
	  // consistently doing. If you have an autoclicker, this is easy to set.
	  var clickFrequency = clicksPerSecond + Math.ceil(autoClickerVariance / 2);

	  /***********
	   * GLOBALS *
	   ***********/
	  var scene;
	  var next = {
		id: -1,
		cost: 0
	  };
	  var necessary = [
		{ id: 0, level: 1 }, // Light Armor
		{ id: 11, level: 1 }, // Medics
		{ id: 2, level: 10 }, // Armor Piercing Round
		{ id: 1, level: 10 }, // Auto-fire Cannon
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
	  var gHealthUpgrades = [0, 8, 20];
	  var gAutoUpgrades = [1, 9, 21];
	  var gDamageUpgrades = [2, 10, 22];
	  var gElementalUpgrades = [3, 4, 5, 6];

	  /***********
	   * HELPERS *
	   ***********/
	  var getUpgrade = function(id) {
		var result = null;
		if (scene.m_rgPlayerUpgrades) {
		  scene.m_rgPlayerUpgrades.some(function(upgrade) {
			if (upgrade.upgrade == id) {
			  result = upgrade;
			  return true;
			}
		  });
		}
		return result;
	  };

	  var canUpgrade = function(id) {
		if (!scene.bHaveUpgrade(id)) return false;
		var data = scene.m_rgTuningData.upgrades[id];
		var required = data.required_upgrade;
		if (required !== undefined) {
		  var level = data.required_upgrade_level || 1;
		  return (level <= scene.GetUpgradeLevel(required));
		}
		return true;
	  };

	  var necessaryUpgrade = function() {
		var best = { id: -1, cost: 0 };
		var upgrade, id;
		while (necessary.length > 0) {
		  upgrade = necessary[0];
		  id = upgrade.id;
		  if (getUpgrade(id).level < upgrade.level) {
			best = { id: id, cost: scene.m_rgTuningData.upgrades[id].cost };
			break;
		  }
		  necessary.shift();
		}
		return best;
	  };

	  var nextAbilityUpgrade = function() {
		var best = { id: -1, cost: 0 };
		gAbilities.some(function(id) {
		  if (canUpgrade(id) && getUpgrade(id).level < 1) {
			best = { id: id, cost: scene.m_rgTuningData.upgrades[id].cost };
			return true;
		  }
		});
		return best;
	  };

	  var bestHealthUpgrade = function() {
		var best = { id: -1, cost: 0, hpg: 0 };
		gHealthUpgrades.forEach(function(id) {
		  if (!canUpgrade(id)) return;
		  var data = scene.m_rgTuningData.upgrades[id];
		  var upgrade = getUpgrade(id);
		  var cost = data.cost * Math.pow(data.cost_exponential_base, upgrade.level);
		  var hpg = scene.m_rgTuningData.player.hp * data.multiplier / cost;
		  if (hpg >= best.hpg) {
			best = { id: id, cost: cost, hpg: hpg };
		  }
		});
		return best;
	  };

	  var bestDamageUpgrade = function() {
		var best = { id: -1, cost: 0, dpg: 0 };
		var dpc = scene.m_rgPlayerTechTree.damage_per_click;
		var data, cost, dpg;

		// check auto damage upgrades
		gAutoUpgrades.forEach(function(id) {
		  if (!canUpgrade(id)) return;
		  data = scene.m_rgTuningData.upgrades[id];
		  cost = data.cost * Math.pow(data.cost_exponential_base, getUpgrade(id).level);
		  dpg = (scene.m_rgPlayerTechTree.base_dps / clickFrequency) * data.multiplier / cost;
		  if (dpg >= best.dpg) {
			best = { id: id, cost: cost, dpg: dpg };
		  }
		});

		// check click damage direct upgrades
		gDamageUpgrades.forEach(function(id) {
		  if (!canUpgrade(id)) return;
		  data = scene.m_rgTuningData.upgrades[id];
		  cost = data.cost * Math.pow(data.cost_exponential_base, getUpgrade(id).level);
		  dpg = scene.m_rgTuningData.player.damage_per_click * data.multiplier / cost;
		  if (dpg >= best.dpg) {
			best = { id: id, cost: cost, dpg: dpg };
		  }
		});

		// check Lucky Shot
		if (canUpgrade(7)) {
		  data = scene.m_rgTuningData.upgrades[7];
		  cost = data.cost * Math.pow(data.cost_exponential_base, getUpgrade(7).level);
		  dpg = (scene.m_rgPlayerTechTree.crit_percentage * dpc) * data.multiplier / cost;
		  if (dpg > best.dpg) {
			best = { id: 7, cost: cost, dpg: dpg };
		  }
		}

		// check elementals
		data = scene.m_rgTuningData.upgrades[4];
		var elementalLevels = gElementalUpgrades.reduce(function(sum, id) {
		  return sum + getUpgrade(id).level;
		}, 1);
		cost = data.cost * Math.pow(data.cost_exponential_base, elementalLevels);
		dpg = (elementalCoefficient * dpc) * data.multiplier / cost;
		if (dpg >= best.dpg) {
		  // get level of upgrade based on number of `elementalSpecializations`
		  var level = gElementalUpgrades
			.map(function(id) { return getUpgrade(id).level; })
			.sort(function(a, b) { return b - a; })[elementalSpecializations - 1];

		  // find all matches elements and randomly pick one
		  var match = gElementalUpgrades
			.filter(function(id) { return getUpgrade(id).level == level; });
		  match = match[Math.floor(Math.random() * match.length)];

		  best = { id: match, cost: cost, dpg: dpg };
		}

		return best;
	  };

	  var timeToDie = function() {
		var maxHp = scene.m_rgPlayerTechTree.max_hp;
		var enemyDps = scene.m_rgGameData.lanes.reduce(function(max, lane) {
		  return Math.max(max, lane.enemies.reduce(function(sum, enemy) {
			return sum + enemy.dps;
		  }, 0));
		}, 0);
		return maxHp / (enemyDps || scene.m_rgGameData.level * 4 || 1);
	  };

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
		if (debug && next.id !== -1) {
		  console.log(
			'next buy:',
			scene.m_rgTuningData.upgrades[next.id].name,
			'(' + FormatNumberForDisplay(next.cost) + ')'
		  );
		}
	  };

	  /********
	   * MAIN *
	   ********/
	  return function() {
		scene = g_Minigame.CurrentScene();
		if (scene.m_bUpgradesBusy) return;
		if (next.id === -1 || timeToDie() < survivalTime) updateNext();
		if (next.id !== -1) {
		  if (next.cost <= scene.m_rgPlayerData.gold) {
			$J('.link').each(function() {
			  if ($J(this).data('type') === next.id) {
				scene.TryUpgrade(this);
				next.id = -1;
				return false;
			  }
			});
		  }
		}
	  };
	}, upgradeManagerFreq );
	
	console.log("autoUpgradeManager has been started.");
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

	updateUserElementMultipliers();
	autoTargetSwapperElementUpdate = setInterval(updateUserElementMultipliers, elementUpdateRate);
	
	autoTargetSwapper = setInterval(function() {

		var currentTarget = null;
		g_Minigame.m_CurrentScene.m_rgEnemies.each(function(potentialTarget){
				if(compareMobPriority(potentialTarget, currentTarget))
					currentTarget = potentialTarget;
		});
			
		//Switch to that target
		var oldTarget = g_Minigame.m_CurrentScene.m_rgEnemies[g_Minigame.m_CurrentScene.m_rgPlayerData.target];
		if(currentTarget != null && (oldTarget == undefined || currentTarget.m_data.id != oldTarget.m_data.id)) {
			if(debug && swapReason != null) {
				console.log(swapReason);
				swapReason = null;
			}
			
			if(g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != currentTarget.m_nLane)
				g_Minigame.m_CurrentScene.TryChangeLane(currentTarget.m_nLane);
			g_Minigame.m_CurrentScene.TryChangeTarget(currentTarget.m_nID);
		}
		//Move back to lane if still targetting
		else if(currentTarget != null && oldTarget == undefined && currentTarget.m_data.id != oldTarget.m_data.id && g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != currentTarget.m_nLane) {
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
			
			// Only use if there isn't already a Medics active?
			if(hasAbility(7) && !currentLaneHasAbility(7)) {
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
		//Temporarily disabled until we find a better trigger condition
		/*
		if(hasAbility(9) && !currentLaneHasAbility(9)) { 
			// TODO: Any logic to using this?
			if(debug)
				console.log('Decreasing cooldowns.');
			
			castAbility(9);
		}
		*/
		
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
		
		// Steal Health
		var percentHPRemaining = g_Minigame.CurrentScene().m_rgPlayerData.hp  / g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp * 100;
		if(percentHPRemaining <= useStealHealthAtPercent && !g_Minigame.m_CurrentScene.m_bIsDead) {
			
			//Can  cast and no other heals
			if(hasAbility(23) && !currentLaneHasAbility(7)) {
				if(debug)
					console.log("Stealing Health!");
				castAbility(23);
			}
		}
		
	}, itemUseCheckFreq);
	
	console.log("autoItemUser has been started.");
}

function startAllAutos() {
	startAutoClicker();
	startAutoRespawner();
	startAutoTargetSwapper();
	startAutoAbilityUser();
	startAutoItemUser();
	startAutoUpgradeManager();
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
function stopAutoUpgradeManager() {
	if(autoUpgradeManager){
		clearInterval(autoUpgradeManager);
		autoUpgradeManager = null;
		console.log("autoUpgradeManager has been stopped.");
	}
	else
		console.log("No autoUpgradeManager is running to stop.");
}

function stopAllAutos() {
	stopAutoClicker();
	stopAutoRespawner();
	stopAutoTargetSwapper();
	stopAutoAbilityUser();
	stopAutoItemUser();
	stopAutoUpgradeManager();
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
	return laneHasAbility(g_Minigame.CurrentScene().m_rgPlayerData.current_lane, abilityID);
}

function laneHasAbility(lane, abilityID) {
	return g_Minigame.m_CurrentScene.m_rgLaneData[lane].abilities[abilityID];
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
	
	userElementMultipliers[3] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_air;
	userElementMultipliers[4] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_earth;
	userElementMultipliers[1] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_fire;
	userElementMultipliers[2] = g_Minigame.m_CurrentScene.m_rgPlayerTechTree.damage_multiplier_water;
	
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
	if(mobA == null)
		return false;
	if(mobB == null) {
		swapReason = "Swapping off a non-existent mob.";
		return true;
	}
	
	var percentHPRemaining = g_Minigame.CurrentScene().m_rgPlayerData.hp  / g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp * 100;
	var aHasHealing = laneHasAbility(mobA.m_nLane, 7) || laneHasAbility(mobA.m_nLane, 23);
	var bHasHealing = laneHasAbility(mobB.m_nLane, 7) || laneHasAbility(mobB.m_nLane, 23);

	var aIsGold = laneHasAbility(mobA.m_nLane, 17);
	var bIsGold = laneHasAbility(mobB.m_nLane, 17);
	
	var aTypePriority = getMobTypePriority(mobA);
	var bTypePriority = getMobTypePriority(mobB);
	
	var aElemMult = userElementMultipliers[g_Minigame.m_CurrentScene.m_rgGameData.lanes[mobA.m_nLane].element];
	var bElemMult = userElementMultipliers[g_Minigame.m_CurrentScene.m_rgGameData.lanes[mobB.m_nLane].element];

	//check for Max Elemental Damage Ability
	if(laneHasAbility(mobA.m_nLane, 16))
		aElemMult = userMaxElementMultiiplier;
	if(laneHasAbility(mobB.m_nLane, 16))
		bElemMult = userMaxElementMultiiplier;
	
	
	var aHP = mobA.m_data.hp;
	var bHP = mobB.m_data.hp;

	//First, make sure they're alive
	if(mobA.m_bIsDestroyed)
		return false;
	else if(mobB.m_bIsDestroyed) {
		swapReason = "Swapping off a destroyed mob.";
		return true;
	}
	
	//Run to a medic lane if needed
	else if(percentHPRemaining <= seekHealingPercent && !g_Minigame.m_CurrentScene.m_bIsDead) {
		if(aHasHealing != bHasHealing) {
			if(aHasHealing) {
				swapReason = "Swapping to lane with active healing.";
				return true;
			}
		}
	}

	else if(aIsGold != bIsGold) {
		if(aIsGold) {
			swapReason = "Switching to target with Raining Gold.";
			return true;
		}
	}
	else if(aTypePriority != bTypePriority) {		
		if(aTypePriority > bTypePriority) {
			swapReason = "Switching to higher priority target.";
			return true;
		}
	}
	else if(aElemMult != bElemMult) {
		if(aElemMult > bElemMult) {
			swapReason = "Switching to elementally weaker target.";
			return true;
		}
	}
	else if(aHP != bHP) {
		if(aHP < bHP) {
			swapReason = "Switching to lower HP target.";
			return true;
		}
	}
	return false;
}

function gameRunning() {
	return typeof g_Minigame === "object" && g_Minigame.m_CurrentScene.m_rgGameData.status == 2;
}

function addPointer() {
	g_Minigame.m_CurrentScene.m_rgFingerTextures = [];
	var w = 26;
	var h = 49;


	for( var y = 0; y < 4; y++)
	{
		for( var x = 0; x < 5; x++ )

		{
			g_Minigame.m_CurrentScene.m_rgFingerTextures.push( new PIXI.Texture( g_rgTextureCache.pointer.texture, {
				x: x * w,
				y: y * h,
				width: w,
				height: h
			} )
			);
		}
	}

	g_Minigame.m_CurrentScene.m_nFingerIndex = 0;

	g_Minigame.m_CurrentScene.m_spriteFinger = new PIXI.Sprite( g_Minigame.m_CurrentScene.m_rgFingerTextures[g_Minigame.m_CurrentScene.m_nFingerIndex] );
	g_Minigame.m_CurrentScene.m_spriteFinger.scale.x = g_Minigame.m_CurrentScene.m_spriteFinger.scale.y = 2;

	g_Minigame.m_CurrentScene.m_containerParticles.addChild( g_Minigame.m_CurrentScene.m_spriteFinger );
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
	unsafeWindow.stopAutoUpgradeManager = stopAutoUpgradeManager;
	unsafeWindow.stopAllAutos = stopAllAutos;
	unsafeWindow.disableAutoNukes = disableAutoNukes;
	unsafeWindow.castAbility = castAbility;
	unsafeWindow.hasAbility = hasAbility;
	//Add closure 'debug' getter and setter
    	unsafeWindow.getDebug = function() { return debug; };
    	unsafeWindow.setDebug = function(state) { debug = state; };
}

//Keep trying to start every second till success
var startAll = setInterval(function() { 
		if(!gameRunning())
			return;
		
		startAllAutos();
		addPointer();
		clearInterval(startAll);
		
		// Overwrite this function so it doesn't delete our sexy pointer
		CSceneGame.prototype.ClearNewPlayer = function() {
			if( this.m_spriteFinger )  {
				var bPlayedBefore = WebStorage.SetLocal('mg_how2click', 1);
				$J('#newplayer').hide();
			}
		}

	}, 1000);



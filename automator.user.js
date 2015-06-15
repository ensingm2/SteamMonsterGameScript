// ==UserScript== 
// @name Steam Monster Game Script
// @namespace https://github.com/ensingm2/SteamMonsterGameScript
// @description A Javascript automator for the 2015 Summer Steam Monster Minigame
// @version 1.61
// @match http://steamcommunity.com/minigame/towerattack*
// @match http://steamcommunity.com//minigame/towerattack*
// @updateURL https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/automator.user.js
// @downloadURL https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/automator.user.js
// @require https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/slaveWindows.js
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
var autoBuyAbilities = false;

//item use variables
var useMedicsAtPercent = 30;
var useMedicsAtLanePercent = 40;
var useMedicsAtLanePercentAliveReq = 40;
var useNukeOnSpawnerAbovePercent = 75;
var useMetalDetectorOnBossBelowPercent = 30;

var useStealHealthAtPercent = 15;
var useRainingGoldAbovePercent = 75;
var useLikeNewAboveCooldown = 14220000; // Need to save at least 14220s of cooldowns(60% of max)
var useResurrectToSaveCount = 150; // Use revive to save 150 people

// You shouldn't need to ever change this, you only push to server every 1s anyway
var autoClickerFreq = 1000;

// Internal variables, you shouldn't need to touch these
var autoRespawner, autoClicker, autoTargetSwapper, autoTargetSwapperElementUpdate, autoAbilityUser, autoUpgradeManager;
var elementUpdateRate = 60000;
var autoUseConsumables = true;
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
		g_Minigame.m_CurrentScene.m_nClicks += clicks;
		
		// Anti-anti-clicker countermeasure
		g_msTickRate = 1100;
		
		// Update Gold Counter
		var nClickGoldPct = g_Minigame.m_CurrentScene.m_rgGameData.lanes[  g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane ].active_player_ability_gold_per_click;
		var enemy = getTarget();
		if(enemy && nClickGoldPct > 0 && enemy.m_data.hp > 0) {
			var nClickGold = enemy.m_data.gold * nClickGoldPct * g_Minigame.m_CurrentScene.m_nClicks;
			g_Minigame.m_CurrentScene.ClientOverride('player_data', 'gold', g_Minigame.m_CurrentScene.m_rgPlayerData.gold + nClickGold );
			g_Minigame.m_CurrentScene.ApplyClientOverrides('player_data', true );
		};
			
		//Clear out the crits
		var numCrits =  g_Minigame.m_CurrentScene.m_rgStoredCrits.length;
		g_Minigame.m_CurrentScene.m_rgStoredCrits = [];
		
		if(debug) {
			if(numCrits > 1)
				console.log('Clicking ' + g_Minigame.m_CurrentScene.m_nClicks + ' times this second. (' + numCrits + ' crits).');
			if(numCrits == 1)
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

var upgradeManagerPrefilter;
if (!upgradeManagerPrefilter) {
	// add prefilter on first run
	$J.ajaxPrefilter(function() {
		// this will be defined by the end of the script
		if(upgradeManagerPrefilter !== undefined) {
			upgradeManagerPrefilter.apply(this, arguments);
		}
	});
}

function startAutoUpgradeManager() {
	if( autoUpgradeManager ) {
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

	  // How many elements do you want to upgrade? If we decide to upgrade an
	  // element, we'll try to always keep this many as close in levels as we
	  // can, and ignore the rest.
	  var elementalSpecializations = 1;

	  // To include passive DPS upgrades (Auto-fire, etc.) we have to scale
	  // down their DPS boosts for an accurate comparison to clicking. This
	  // is approximately how many clicks per second we should assume you are
	  // consistently doing. If you have an autoclicker, this is easy to set.
	  var clickFrequency = clicksPerSecond + Math.ceil(autoClickerVariance / 2);

	  // Should we buy abilities? Note that Medics will always be bought since
	  // it is considered a necessary upgrade.
	  var buyAbilities = false;

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

	  var gHealthUpgrades = [
		0,  // Light Armor
		8,  // Heavy Armor
		20, // Energy Shields
		23, // Personal Training
	  ];

	  var gAutoUpgrades = [1, 9, 21, 24]; // nobody cares

	  var gLuckyShot = 7;

	  var gDamageUpgrades = [
		2,  // Armor Piercing Round
		10, // Explosive Rouds
		22, // Railgun
		25, // New Mouse Button
	  ];

	  var gElementalUpgrades = [3, 4, 5, 6]; // Fire, Water, Earth, Air

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

	  var getElementals = (function() {
		var cache = false;
		return function(refresh) {
		  if (!cache || refresh) {
			cache = gElementalUpgrades
			  .map(function(id) { return { id: id, level: getUpgrade(id).level }; })
			  .sort(function(a, b) { return b.level - a.level; });
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
		var base_dpc = scene.m_rgTuningData.player.damage_per_click;
		var data = scene.m_rgTuningData.upgrades[id];
		var boost = 0;
		var cost = 0;
		var parent;

		var cur_level = getUpgrade(id).level;
		if (level === undefined) level = cur_level + 1;

		// for each missing level, add boost and cost
		for (var level_diff = level - getUpgrade(id).level; level_diff > 0; level_diff--) {
		  boost += base_dpc * data.multiplier;
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

		return { boost: boost, cost: cost, required: parent };
	  };

	  var necessaryUpgrade = function() {
		var best = { id: -1, cost: 0 };
		var wanted, id, current;
		while (necessary.length > 0) {
		  wanted = necessary[0];
		  id = wanted.id;
		  current = getUpgrade(id);
		  if (current.level < wanted.level) {
			var data = scene.m_rgTuningData.upgrades[id];
			best = { id: id, cost: data.cost * Math.pow(data.cost_exponential_base, current.level) };
			break;
		  }
		  necessary.shift();
		}
		return best;
	  };

	  var nextAbilityUpgrade = function() {
		var best = { id: -1, cost: 0 };
		if (autoBuyAbilities) {
		  gAbilities.some(function(id) {
			if (canUpgrade(id) && getUpgrade(id).level < 1) {
			  best = { id: id, cost: scene.m_rgTuningData.upgrades[id].cost };
			  return true;
			}
		  });
		}
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
		var data, cost, dpg, boost;

		var dpc = scene.m_rgPlayerTechTree.damage_per_click;
		var base_dpc = scene.m_rgTuningData.player.damage_per_click;
		var critmult = scene.m_rgPlayerTechTree.damage_multiplier_crit;
		var critrate = scene.m_rgPlayerTechTree.crit_percentage - scene.m_rgTuningData.player.crit_percentage;
		var elementals = getElementals();
		var elementalCoefficient = getElementalCoefficient(elementals);

		// lazily check auto damage upgrades; assume we don't care about these
		gAutoUpgrades.forEach(function(id) {
		  if (!canUpgrade(id)) return;
		  data = scene.m_rgTuningData.upgrades[id];
		  cost = data.cost * Math.pow(data.cost_exponential_base, getUpgrade(id).level);
		  dpg = (scene.m_rgPlayerTechTree.base_dps / clickFrequency) * data.multiplier / cost;
		  if (dpg >= best.dpg) {
			best = { id: id, cost: cost, dpg: dpg };
		  }
		});

		// check Lucky Shot
		if (canUpgrade(gLuckyShot)) { // lazy check because prereq is necessary upgrade
		  data = scene.m_rgTuningData.upgrades[gLuckyShot];
		  boost = dpc * critrate * data.multiplier;
		  cost = data.cost * Math.pow(data.cost_exponential_base, getUpgrade(gLuckyShot).level);
		  dpg = boost / cost;
		  if (dpg >= best.dpg) {
			best = { id: gLuckyShot, cost: cost, dpg: dpg };
		  }
		}

		// check click damage upgrades
		gDamageUpgrades.forEach(function(id) {
		  var result = calculateUpgradeTree(id);
		  boost = result.boost * (critrate * critmult + (1 - critrate) * elementalCoefficient);
		  cost = result.cost;
		  dpg = boost / cost;
		  if (dpg >= best.dpg) {
			if (result.required) {
			  id = result.required;
			  data = scene.m_rgTuningData.upgrades[id];
			  cost = data.cost * Math.pow(data.cost_exponential_base, getUpgrade(id).level);
			}
			best = { id: id, cost: cost, dpg: dpg };
		  }
		});

		// check elementals
		data = scene.m_rgTuningData.upgrades[4];
		var elementalLevels = elementals.reduce(function(sum, elemental) {
		  return sum + elemental.level;
		}, 1);
		cost = data.cost * Math.pow(data.cost_exponential_base, elementalLevels);

		// - make new elementals array for testing
		var testElementals = elementals.map(function(elemental) { return { level: elemental.level }; });
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
		  var match = elementals.filter(function(elemental) { return elemental.level == upgradeLevel; });
		  match = match[Math.floor(Math.random() * match.length)].id;
		  best = { id: match, cost: cost, dpg: dpg };
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
		if (debug && next.id !== -1) {
		  console.log(
			'next buy:',
			scene.m_rgTuningData.upgrades[next.id].name,
			'(' + FormatNumberForDisplay(next.cost) + ')'
		  );
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
	  hook(CSceneGame, 'TryUpgrade', function() {
		  // if it's a valid try, we should reevaluate after the update
		  if (this.m_bUpgradesBusy) next.id = -1;
	  });

	  hook(CSceneGame, 'ChangeLevel', function() {
		// recalculate enemy DPS to see if we can survive this level
		if (timeToDie(true) < survivalTime) updateNext();
	  });

	  upgradeManagerPrefilter = function(opts, origOpts, xhr) {
		if (opts.url.match(/ChooseUpgrade/)) {
		  xhr
			.success(function() {
			  // wait as short a delay as possible
			  // then we re-run to figure out the next item to queue
			  window.setTimeout(autoUpgradeManager, 0);
			})
			.fail(function() {
			  // we're desynced. wait til data refresh
			  // m_bUpgradesBusy was not set to false
			  scene.m_bNeedTechTree = true;
			  waitingForUpdate = true;
			});
		} else if (opts.url.match(/GetPlayerData/)) {
		  if (waitingForUpdate) {
			xhr.success(function(result) {
			  var message = g_Server.m_protobuf_GetPlayerDataResponse.decode(result).toRaw(true, true);
			  if (message.tech_tree) {
			  	// done waiting! no longer busy
			  	waitingForUpdate = false;
			  	scene.m_bUpgradesBusy = false;
			  }
			});
		  }
		}
	  };

	autoUpgradeManager = setInterval(function() {
		if(debug)
			console.log('Checking for worthwhile upgrades');
		scene = g_Minigame.CurrentScene();

		// tried to buy upgrade and waiting for reply; don't do anything
		if (scene.m_bUpgradesBusy) return;

		// no item queued; refresh stats and queue next item
		if (next.id === -1) {
			getElementals(true);
			timeToDie(true);
			updateNext();
		}

		// item queued; buy if we can afford it
		if (next.id !== -1) {
		  if (next.cost <= scene.m_rgPlayerData.gold) {
			$J('.link').each(function() {
			  if ($J(this).data('type') === next.id) {
				scene.TryUpgrade(this);
				return false;
			  }
			});
		  }
		}
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
		var oldTarget = getTarget();
		if(currentTarget != null && (!oldTarget || currentTarget.m_data.id != oldTarget.m_data.id)) {
			if(debug && swapReason != null) {
				console.log(swapReason);
				swapReason = null;
			}
			
			if(g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != currentTarget.m_nLane)
				g_Minigame.m_CurrentScene.TryChangeLane(currentTarget.m_nLane);
			g_Minigame.m_CurrentScene.TryChangeTarget(currentTarget.m_nID);

		}
		//Move back to lane if still targetting
		else if(currentTarget != null && !oldTarget && currentTarget.m_data.id != oldTarget.m_data.id && g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane != currentTarget.m_nLane) {
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
		var target = getTarget();
		var currentLane = g_Minigame.m_CurrentScene.m_rgGameData.lanes[g_Minigame.CurrentScene().m_rgPlayerData.current_lane];
		
		// Abilities only used on targets
		if(target) {
			
			var targetPercentHPRemaining = target.m_data.hp / target.m_data.max_hp * 100;
			var laneDPS = g_Minigame.m_CurrentScene.m_rgLaneData[g_Minigame.CurrentScene().m_rgPlayerData.current_lane].friendly_dps;
			var timeToTargetDeath = target.m_data.hp / laneDPS;
				
			// First priority since it can use Decrease Cooldowns
			// Abilities only used when targeting Spawners
			if(target.m_data.type == 0) {
				// Morale Booster, Good Luck Charm, and Decrease Cooldowns
				var moraleBoosterReady = hasAbility(5);
				var goodLuckCharmReady = hasAbility(6);
				var critReady = (hasAbility(18) && autoUseConsumables);
				
				// Only use items on targets that are spawners and have nearly full health
				if(targetPercentHPRemaining >= 90  && autoUseConsumables) {
					// Check to see if Cripple Spawner and Cripple Monster items are ready to use
					if(hasAbility(14)){
						castAbility(14);
					}else if(hasAbility(15)){
						castAbility(15);
					}
				}
				else if(moraleBoosterReady || critReady || goodLuckCharmReady) {
					// If we have both we want to combo them
					var moraleBoosterUnlocked = abilityIsUnlocked(5);
					var goodLuckCharmUnlocked = abilityIsUnlocked(6);

					// "if Moral Booster isn't unlocked or Good Luck Charm isn't unlocked, or both are ready"
					if((!moraleBoosterUnlocked  && !critReady) || !goodLuckCharmUnlocked || ((moraleBoosterReady || critReady ) && goodLuckCharmReady)) {
						var currentLaneHasCooldown = currentLaneHasAbility(9);
						// Only use on targets that are spawners and have nearly full health
						if(targetPercentHPRemaining >= 70 || (currentLaneHasCooldown && targetPercentHPRemaining >= 60)) {
							// Combo these with Decrease Cooldowns ability

							// If Decreased Cooldowns will be available soon, wait
							if(
							   currentLaneHasCooldown || // If current lane already has Decreased Cooldown, or
							   hasAbility(9) ||			 // If we have the ability ready
							   !abilityIsUnlocked(9) ||  // if we haven't unlocked the ability yet, or
							   (abilityCooldown(9) > 60) // if cooldown > 60
							  ) {
								if(hasAbility(9) && !currentLaneHasAbility(9)) {
									// Other abilities won't benifit if used at the same time
									if(debug)
										console.log('Triggering Decrease Cooldown!');
									castAbility(9);
								}
								else {
									// Use these abilities next pass
									
									//Use crit if one's available
									if(critReady) {
										if(debug)
											console.log("Using Crit!");
										castAbility(18);
									}
									else if (moraleBoosterReady) {
										if(debug)
											console.log("Casting Morale Booster!");
										castAbility(5);
									}
									
									if(goodLuckCharmReady) {
										if(debug)
											console.log("Casting Good Luck Charm!");
										castAbility(6);
									}
								}
							}
						}
					}
				}

				// Metal Detector
				var  treasureReady = hasAbility(22) && autoUseConsumables;
				if((target.m_data.type == 2 || target.m_data.type == 4) && timeToTargetDeath < 10) {
					if(hasAbility(8) || treasureReady) {
						if(treasureReady){
							if(debug)
								console.log('Using Metal Detector via Treasure.');
							castAbility(22);
						}
						else {
							if(debug)
								console.log('Using Metal Detector.');
							castAbility(8);
						}
					}
				}

				// Tactical Nuke
				if(hasAbility(10) && targetPercentHPRemaining >= useNukeOnSpawnerAbovePercent) {
					if(debug)
						console.log('Nuclear launch detected.');
					
					castAbility(10);
				}

		
				// Napalm
				else if(hasAbility(12) && targetPercentHPRemaining >= useNukeOnSpawnerAbovePercent && currentLane.enemies.length >= 4) { 
				
					if(debug)
						console.log('Triggering napalm!');
					
					castAbility(12);
				}
				
				// Cluster Bomb
				else if(hasAbility(11) && targetPercentHPRemaining >= useNukeOnSpawnerAbovePercent && currentLane.enemies.length >= 4) {
					
					if(debug)
						console.log('Triggering cluster bomb!');
					
					castAbility(11);
				}

			}
			
			//Use cases for bosses
			else if(target.m_data.type == 2) {
				//Raining Gold
				if(hasAbility(17) && autoUseConsumables && targetPercentHPRemaining > useRainingGoldAbovePercent) {
					
					if(debug)
						console.log('Using Raining Gold on boss.');
					
					castAbility(17);
				}
			}
		}
		
		//Estimate average player HP Percent in lane
		var laneTotalPctHP = 0;
		var laneTotalCount = 0;
		for(var i=1; i<10; i++) {
			var HPGuess = ((i-1)*10 + 5);
			laneTotalPctHP += HPGuess * currentLane.player_hp_buckets[i];
			laneTotalCount += currentLane.player_hp_buckets[i];
		}
		var avgLanePercentHP = laneTotalPctHP / laneTotalCount;
		var percentAlive = laneTotalCount / (laneTotalCount + currentLane.player_hp_buckets[0]) * 100;
		
		// Medics
		if((percentHPRemaining <= useMedicsAtPercent || (avgLanePercentHP <= useMedicsAtLanePercent && percentAlive > useMedicsAtLanePercentAliveReq)) && !g_Minigame.m_CurrentScene.m_bIsDead) {
			if(debug) {
				if(percentHPRemaining <= useMedicsAtPercent)
					console.log("Health below threshold. Need medics!");
				if(avgLanePercentHP <= useMedicsAtLanePercent && percentAlive > useMedicsAtLanePercentAliveReq)
					console.log("Average lane below threshold. Need medics!");
			}
			
			// Only use if there isn't already a Medics active?
			var pumpedUpReady = hasAbility(19) && autoUseConsumables;
			var stealHealthReady = hasAbility(23) && autoUseConsumables;
			if((hasAbility(7) || pumpedUpReady) && !currentLaneHasAbility(7)) {
				
				if(pumpedUpReady){
					if(debug)
						console.log("Using Medics via Pumped Up!");
					castAbility(19);
				}
				else {
					if(debug)
						console.log("Using Medics!");
					castAbility(7);
				}
			}
			else if(stealHealthReady && percentHPRemaining <= useMedicsAtPercent) {
					if(debug)
						console.log("Using Steal Health in place of Medics!");
					castAbility(23);
			}
			else if(debug)
				console.log("No medics to unleash!");
		}
		
		// Resurrect
		if(hasAbility(13) && autoUseConsumables) {
			if(currentLane.player_hp_buckets[0] <= useResurrectBelowLaneAlive) {
				if(debug)
					console.log('Using resurrection to save ' + currentLane.player_hp_buckets[0] + ' lane allies.');
				castAbility(13);
			}
		}
		
		// Like New
		if(hasAbility(27) && autoUseConsumables) {
			var totalCD = 0;
			for(var i=5; i <= 12; i++)
				if(abilityIsUnlocked(i))
					totalCD += abilityCooldown(i);
				
			if(totalCD * 1000 >= useLikeNewAboveCooldown) {
				if(debug)
					console.log('Using resurrection to save a total of ' + totalCD + ' seconds of cooldown.');
				castAbility(27);
			}
		}
			
		
	}, abilityUseCheckFreq);
	
	console.log("autoAbilityUser has been started.");
}

function startAutoItemUser() {
	autoUseConsumables = true;
	console.log("Automatic use of consumables has been enabled.");
}

function startAllAutos() {
	startAutoClicker();
	startAutoRespawner();
	startAutoTargetSwapper();
	startAutoAbilityUser();
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
	autoUseConsumables = false;
	console.log("Automatic use of consumables has been disabled.");
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
	if(hasAbility(abilityID)) {
		if(abilityID <= 12 && document.getElementById('ability_' + abilityID) != null)
			g_Minigame.CurrentScene().TryAbility(document.getElementById('ability_' + abilityID).childElements()[0]);
		else if(document.getElementById('abilityitem_' + abilityID) != null)
			g_Minigame.CurrentScene().TryAbility(document.getElementById('abilityitem_' + abilityID).childElements()[0]);
	}
}

function currentLaneHasAbility(abilityID) {
	return laneHasAbility(g_Minigame.CurrentScene().m_rgPlayerData.current_lane, abilityID);
}

function laneHasAbility(lane, abilityID) {
	if(typeof(g_Minigame.m_CurrentScene.m_rgLaneData[lane].abilities[abilityID]) == 'undefined')
		return 0;
	return g_Minigame.m_CurrentScene.m_rgLaneData[lane].abilities[abilityID];
	
}

function abilityIsUnlocked(abilityID) {
		if(abilityID <= 12)
			return ((1 << abilityID) & g_Minigame.CurrentScene().m_rgPlayerTechTree.unlocked_abilities_bitfield) > 0;
		else
			return getAbilityItemQuantity(abilityID) > 0;
}

function getAbilityItemQuantity(abilityID) {
	for ( var i = 0; i < g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items.length; ++i ) {
		var abilityItem = g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items[i];

		if(abilityItem.ability == abilityID)
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
	if(!gameRunning() || !g_Minigame.m_CurrentScene.m_rgPlayerTechTree) return;
	
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
	if(mobA.m_bIsDestroyed || aHP <= 0)
		return false;
	else if(mobB.m_bIsDestroyed || bHP <= 0) {
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
		if(aIsGold > bIsGold && (mobB.m_data.type == 3 || mobB.m_data.type == 1)) {
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
	try {
		return (typeof g_Minigame === "object" && g_Minigame.m_CurrentScene.m_rgGameData.status == 2);
	}
	catch (e) {
		return false;
	}
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

function getTarget() {
	return g_Minigame.m_CurrentScene.GetEnemy(
		g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane,
		g_Minigame.m_CurrentScene.m_rgPlayerData.target
	);
}
		

//Expose functions if running in userscript
if(typeof unsafeWindow != 'undefined') {
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

	//item use variables
	unsafeWindow.useMedicsAtPercent = useMedicsAtPercent;
	unsafeWindow.useMedicsAtLanePercent = useMedicsAtLanePercent;
	unsafeWindow.useMedicsAtLanePercentAliveReq = useMedicsAtLanePercentAliveReq;
	unsafeWindow.useNukeOnSpawnerAbovePercent = useNukeOnSpawnerAbovePercent;
	unsafeWindow.useMetalDetectorOnBossBelowPercent = useMetalDetectorOnBossBelowPercent;
	unsafeWindow.useStealHealthAtPercent = useStealHealthAtPercent;
	unsafeWindow.useRainingGoldAbovePercent = useRainingGoldAbovePercent;
	
	//Slave window variables
	unsafeWindow.slaveWindowUICleanup = slaveWindowUICleanup;
	unsafeWindow.slaveWindowPeriodicRestart = slaveWindowPeriodicRestart;
	unsafeWindow.slaveWindowPeriodicRestartInterval = slaveWindowPeriodicRestartInterval;
	
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
	unsafeWindow.toggleAutoClicker = toggleAutoClicker;
	unsafeWindow.toggleAutoTargetSwapper = toggleAutoTargetSwapper;
	unsafeWindow.toggleAutoAbilityUser = toggleAutoAbilityUser;
	unsafeWindow.toggleAutoItemUser = toggleAutoItemUser;
	unsafeWindow.toggleAutoUpgradeManager = toggleAutoUpgradeManager;
	unsafeWindow.spamNoClick = spamNoClick;
	unsafeWindow.toggleSpammer = toggleSpammer;
	
	
	//Hacky way to let people change vars using userscript before I set up getter/setter fns tomorrow
	var varSetter = setInterval(function() {
		if(debug)
			console.log('updating options');
		
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

		//item use variables
		useMedicsAtPercent = unsafeWindow.useMedicsAtPercent;
		useMedicsAtLanePercent = unsafeWindow.useMedicsAtLanePercent;
		useMedicsAtLanePercentAliveReq = unsafeWindow.useMedicsAtLanePercentAliveReq;
		useNukeOnSpawnerAbovePercent = unsafeWindow.useNukeOnSpawnerAbovePercent;
		useMetalDetectorOnBossBelowPercent = unsafeWindow.useMetalDetectorOnBossBelowPercent;
		useStealHealthAtPercent = unsafeWindow.useStealHealthAtPercent;
		useRainingGoldAbovePercent = unsafeWindow.useRainingGoldAbovePercent;
	}, 5000)
	
	//Add closure 'debug' getter and setter
	unsafeWindow.getDebug = function() { return debug; };
	unsafeWindow.setDebug = function(state) { debug = state; };
}

//Keep trying to start every second till success
var startAll = setInterval(function() { 
		if(!gameRunning())
			return;
		
		clearInterval(startAll);
		
		startAllAutos();
		addPointer();
		addCustomButtons();
		
		//Hide the stupid "Leave game" tooltip
		$J('.leave_game_btn').mouseover(function(){
				$J('.leave_game_helper').show();
			})
			.mouseout(function(){
				$J('.leave_game_helper').hide();
			});
		$J('.leave_game_helper').hide();
		
		
		if(typeof runMaster == 'function'){
			//Setup for slave windows
			if(location.search.match(/slave/))
				runSlave();
			else
				runMaster();
		}

		// Overwrite this function so it doesn't delete our sexy pointer
		CSceneGame.prototype.ClearNewPlayer = function() {
			if( this.m_spriteFinger )  {
				var bPlayedBefore = WebStorage.SetLocal('mg_how2click', 1);
				$J('#newplayer').hide();
			}
		}

	}, 1000);

	
function addCustomButtons() {
	//Smack the TV Easter Egg
	$J('<div style="height: 52px; position: absolute; bottom: 85px; left: 828px; z-index: 12;" onclick="SmackTV();"><br><br><span style="font-size:10px; padding: 12px; color: gold;">Smack TV</span></div>').insertBefore('#row_bottom');
	
	//Reformat current buttons
	$J(".leave_game_btn").css({"width": "125px", "background-position": "-75px 0px", "position": "absolute", "bottom": "144px", "z-index": "12", "left": "340px"});
	$J(".leave_game_helper").css({"left": "150px", "top": "-75px", "z-index": "12"});
	$J(".leave_game_btn").html('<span style="padding-right: 50px;">Close</span><br><span style="padding-right: 50px;">Game</span>');
	
	//Overwrite their functions
	$J(".toggle_music_btn").click(toggleMusic).attr('id', 'toggleMusicBtn');
	$J('#toggleMusicBtn').html('<span>' + (WebStorage.GetLocal('minigame_mutemusic') ? 'Enable' : 'Disable') + ' Music</span>');
	$J(".toggle_sfx_btn").click(toggleSFX).attr('id', 'toggleSFXBtn');
	$J('#toggleSFXBtn').html('<span>' + (WebStorage.GetLocal('minigame_mute') ? 'Enable' : 'Disable') + ' SFX</span>');

	$J("#toggleMusicBtn").after('<span id="toggleAllSoundBtn" class="toggle_music_btn" style="display:inline-block;"><span>' + (bIsMuted() ? 'Enable' : 'Disable') + ' All Sound' + '</span></span>');
	$J("#toggleAllSoundBtn").click (toggleAllSound);
    
	//Automator buttons
	$J(".game_options").after('<div class="game_options" id="auto_options"></div>'); // background

	$J("#auto_options").append('<span id="toggleAutoClickerBtn" class="toggle_music_btn" style="display:inline-block;margin-left:6px"><span>Disable AutoClicker</span></span>');
	$J("#toggleAutoClickerBtn").click (toggleAutoClicker);
	
	$J("#auto_options").append('<span id="toggleAutoTargetSwapperBtn" class="toggle_music_btn" style="display:inline-block;"><span>Disable Target Swap</span></span>');
	$J("#toggleAutoTargetSwapperBtn").click (toggleAutoTargetSwapper);
	
	$J("#auto_options").append('<span id="toggleAutoAbilityUserBtn" class="toggle_music_btn" style="display:inline-block;"><span>Disable Ability/Item Use</span></span>');
	$J("#toggleAutoAbilityUserBtn").click (toggleAutoAbilityUser);
	
	$J("#auto_options").append('<span id="toggleAutoItemUserBtn" class="toggle_music_btn" style="display:inline-block;"><span>Disable Auto Consumable Use</span></span>');
	$J("#toggleAutoItemUserBtn").click (toggleAutoItemUser);
	
	$J("#auto_options").append('<span id="toggleAutoUpgradeBtn" class="toggle_music_btn" style="display:inline-block;"><span>Disable Upgrader</span></span>');
	$J("#toggleAutoUpgradeBtn").click (toggleAutoUpgradeManager);
	
	$J("#auto_options").append('<span id="toggleSpammerBtn" class="toggle_music_btn" style="display:inline-block;"><span>Enable Particle Spam</span></span>');
	$J("#toggleSpammerBtn").click (toggleSpammer);

	// Append gameid to breadcrumbs
	var breadcrumbs = document.querySelector('.breadcrumbs');

	if(breadcrumbs) {
		var element = document.createElement('span');
		element.textContent = ' > ';
		breadcrumbs.appendChild(element);

		element = document.createElement('span');
		element.style.color = '#D4E157';
		element.style.textShadow = '1px 1px 0px rgba( 0, 0, 0, 0.3 )';
		element.textContent = 'Room ' + g_GameID;
		breadcrumbs.appendChild(element);
	}
}

function toggleSFX() {
	var disable = WebStorage.GetLocal('minigame_mute');
	if(disable)
		WebStorage.SetLocal('minigame_mute', true);
	else
		WebStorage.SetLocal('minigame_mute', false);
		
	updateSoundBtnText();
}
function toggleMusic() {
	var disable = WebStorage.GetLocal('minigame_mutemusic');
	if(disable){
		WebStorage.SetLocal('minigame_mutemusic', true);
		g_AudioManager.m_eleMusic.pause();
	}
	else {
		WebStorage.SetLocal('minigame_mutemusic', false);
		g_AudioManager.m_eleMusic.play();
	}
	
	updateSoundBtnText();
}

function toggleAllSound() {
	// Enable
	if(bIsMuted()){
		WebStorage.SetLocal('minigame_mute', false);
		WebStorage.SetLocal('minigame_mutemusic', false);
		g_AudioManager.m_eleMusic.play();
	}
	// Disable
	else {
		WebStorage.SetLocal('minigame_mute', true);
		WebStorage.SetLocal('minigame_mutemusic', true);
		g_AudioManager.m_eleMusic.pause();
	}
	
	updateSoundBtnText();
}

function updateSoundBtnText() {
	$J('#toggleSFXBtn').html('<span>' + (WebStorage.GetLocal('minigame_mute') ? 'Enable' : 'Disable') + ' SFX</span>');
	$J('#toggleMusicBtn').html('<span>' + (WebStorage.GetLocal('minigame_mutemusic') ? 'Enable' : 'Disable') + ' Music</span>');
	$J("#toggleAllSoundBtn").html("<span>"+(bIsMuted() ? "Enable" : "Disable")+" All Sound</span>");
}

function toggleAutoClicker() {
	if(autoClicker) {
		stopAutoClicker();
		$J("#toggleAutoClickerBtn").html("<span>Enable AutoClicker</span>");
	}
	else {
		startAutoClicker();
		$J("#toggleAutoClickerBtn").html("<span>Disable AutoClicker</span>");
	}
}
function toggleAutoTargetSwapper() {
	if(autoTargetSwapper) {
		stopAutoTargetSwapper();
		$J("#toggleAutoTargetSwapperBtn").html("<span>Enable Target Swap</span>");
	}
	else {
		startAutoTargetSwapper();
		$J("#toggleAutoTargetSwapperBtn").html("<span>Disable Target Swap</span>");
	}
}
function toggleAutoAbilityUser(){
	if(autoAbilityUser) {
		stopAutoAbilityUser();
		$J("#toggleAutoAbilityUserBtn").html("<span>Enable Ability/Item</span>");
	}
	else {
		startAutoAbilityUser();
		$J("#toggleAutoAbilityUserBtn").html("<span>Disable Ability/Item</span>");
	}
}
function toggleAutoItemUser(){
	if(autoUseConsumables) {
		stopAutoItemUser();
		$J("#toggleAutoItemUserBtn").html("<span>Enable Auto Consumable Use</span>");
	}
	else {
		startAutoItemUser();
		$J("#toggleAutoItemUserBtn").html("<span>Disable Auto Consumable Use</span>");
	}
}
function toggleAutoUpgradeManager(){
	if(autoUpgradeManager) {
		stopAutoUpgradeManager();
		$J("#toggleAutoUpgradeBtn").html("<span>Enable Upgrader</span>");
	}
	else {
		startAutoUpgradeManager();
		$J("#toggleAutoUpgradeBtn").html("<span>Disable Upgrader</span>");
	}
}

var spammer;
function spamNoClick() {
	// Save the click count
	var clickCount = g_Minigame.m_CurrentScene.m_nClicks;
	
	// Perform default click
	g_Minigame.m_CurrentScene.DoClick(
		{
			data: {
				getLocalPosition: function() {
					var enemy = getTarget(),
					laneOffset = enemy.m_nLane * 440;

					return {
						x: enemy.m_Sprite.position.x - laneOffset,
						y: enemy.m_Sprite.position.y - 52
					}
				}
			}
		}
	);
	
	// Restore the click count
	g_Minigame.m_CurrentScene.m_nClicks = clickCount;
}
function toggleSpammer() {
	if(spammer) {
		clearInterval(spammer);
		spammer = null;
		$J("#toggleSpammerBtn").html("<span>Enable Particle Spam</span>");
	}
	else {
		if(confirm("Are you SURE you want to do this? This leads to massive memory leaks farly quickly.")) {
			spammer = setInterval(spamNoClick, 1000 / clicksPerSecond);
			$J("#toggleSpammerBtn").html("<span>Disable Particle Spam</span>");
		}
	}
		
}

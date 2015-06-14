# SteamMonsterGameScript
A Javascript automator for the 2015 Summer Steam Monster Minigame
###DISCLAIMER: I take no responsibility for the use of this program, or any negative effects that may result in using it!###

###ATTENTION: Before spamming me with "I don't see anything therefore it's not working wtf" messages, please read the [Notes](https://github.com/ensingm2/SteamMonsterGameScript#notes) and [Testing](https://github.com/ensingm2/SteamMonsterGameScript#testing) sections of the readme.###

##Basic Use:
Just load the script after the game fully loads in, and all automated processes will start immediately.
To load the script, copy/paste the code from minified.js (or automator.js if you're security-conscious) into your browser console or userscript plugin, and hit return to run it. 
To stop, run "stopAllAutos()" in the console.

##Parts:
Any of the additions can be started or stopped individually:
- **autoClicker:** run "startAutoClicker()" or "stopAutoClicker()" in the console.
- **autoRespawner:** run "startAutoRespawner()" or "stopAutoRespawner()" in the console.
- **autoTargetSwapper:** run "startAutoTargetSwapper()" or "stopAutoTargetSwapper()" in the console.
- **autoAbilityUser:** run "startAutoAbilityUser()" or "stopAutoAbilityUser()" in the console.
- **autoItemUser:** run "startAutoItemUser()" or "stopAutoItemUser()" in the console.
- **autoUpgradeManager:** run "startAutoUpgradeManager()" or "stopAutoUpgradeManager()" in the console.
*There are buttons that get added to the bottom of the game page that toggle these functions for your convenience*

##Variables:
Feel free to edit any variables to suit your needs
- **debug (default: false):** if true, logs all actions to the console.
- **clicksPerSecond (default: g_TuningData.abilities[1].max_num_clicks):** Number of clicks to be sent to the server each second.
- **autoClickerVariance (default: 10% of clicksPerSecond):** amount that the clicks per second can be randomized by (range is clicksPersecond +/- autoClickerVariance)
- **respawnCheckFreq (default: 5000ms):** Duration (in milliseconds) between checks to see if the player needs to be revived.
- **targetSwapperFreq (default: 1000ms):** Duration (in milliseconds) between checks to see if the player needs to change targets.
- **abilityUseCheckFreq (default: 2000ms):** Duration (in milliseconds) between checks to see if it is beneficial to use an active ability
- **itemUseCheckFreq (default: 5000ms):** Duration (in milliseconds) between checks to see if it is beneficial to use a consumable item
- **upgradeManagerFreq (default: 30000):** Duration (in milliseconds) between checks to see if it is beneficial to purchase an upgrade
- **useMedicsAtPercent (default: 30):** % max hp at which to use the medics ability
- **useMedicsAtLanePercent (default: 50):** If average lane health dips below this %, Medics will be used.
- **useMedicsAtLanePercentAliveReq (default: 40):** % of lane allies that must be alive in order to use Medics selflessly
- **useNukeOnSpawnerAbovePercent (default: 75):** Above this % percentage threshold, a nuke will be used on a targeted spawner
- **useMetalDetectorOnBossBelowPercent (default: 30):** Below this % percentage threshold, a Metal Detector will be used on a targeted boss
- **seekHealingPercent (default: 20)** Below this % percentage threshold, script will swap to any lane that has a Healing powerup active
- **useStealHealthAtPercent (default: 15):** % max hp at which to use the Steal Health Item
- **useRainingGoldAbovePercent (default: 75):** Above this % percentage threshold, Raining Gold will be used on a targeted boss

##Notes:
This script does not output particles for clicks, so you will not see damage output from the autoclicker. This is intended, as it reduces lag and removes a fairly large memory leak in the base game.
You will however see the output from the attacks made by any auto-fire cannons or your own manual clicks, as we haven't altered that code.
See the [Testing](https://github.com/ensingm2/SteamMonsterGameScript#testing) section of this readme if you want to make sure things are working.

##Testing:
If you would like to test the script, you have a few options
- Use a browser add-on such as Firebug for Firefox and view the POST data being sent to the server. This is the best testing method as you can see exactly what's being sent to the server.
- If you're running in chrome and just want to make sure the scripts are running, type "debug=true" into the console, and it will enable debug console logs as things happen.

##Using code from this in your own script?##
Yeah, you're welcome to. It'd be nice of you to give some type of credit to whoever originally added that feature though, instead of direct copy-pasting into your project under your own name (hi [wchill](https://github.com/wchill/steamSummerMinigame)).

##TODO:
- Finish automating use of abilities & items
- Bug Fixes?

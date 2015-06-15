# SteamMonsterGameScript
A Javascript automator for the 2015 Summer Steam Monster Minigame
###DISCLAIMER: I take no responsibility for the use of this program, or any negative effects that may result in using it!###

###ATTENTION: Before spamming me with "I don't see anything therefore it's not working wtf" messages, please read the [Notes](https://github.com/ensingm2/SteamMonsterGameScript#notes) and [Testing](https://github.com/ensingm2/SteamMonsterGameScript#testing) sections of the readme.###

##Links:
- [Reddit Thread](https://www.reddit.com/r/SteamMonsterGame/comments/39lv9t/customizable_js_autoclicker_targetlanechanger_and/)
- [/r/SteamMonsterGame/](https://www.reddit.com/r/SteamMonsterGame/)

#How To Use:
###UserScript via Greasemonkey or Tampermonkey (Preferred Method, allows slave windows):
1. Download the relevent addon if you don't already have it
    - [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) for Chrome
    - [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) for  Firefox
2. Install the script by visiting [this link](https://raw.githubusercontent.com/ensingm2/SteamMonsterGameScript/master/automator.user.js) and pressing 'Install'
3. The script will now automatically load whenever you visit http://steamcommunity.com/minigame/towerattack/
4. Enjoy!

##Javascript Only Version (No slave window support)
To load the script, copy/paste the code from either automator.user.js or minified.js or into your browser console or userscript plugin, and hit return to run it.

##Parts:
Any of the additions can be started or stopped individually:
- **autoClicker:** run "startAutoClicker()" or "stopAutoClicker()" in the console.
- **autoRespawner:** run "startAutoRespawner()" or "stopAutoRespawner()" in the console.
- **autoTargetSwapper:** run "startAutoTargetSwapper()" or "stopAutoTargetSwapper()" in the console.
- **autoAbilityUser:** run "startAutoAbilityUser()" or "stopAutoAbilityUser()" in the console.
- **autoItemUser:** run "startAutoItemUser()" or "stopAutoItemUser()" in the console.
- **autoUpgradeManager:** run "startAutoUpgradeManager()" or "stopAutoUpgradeManager()" in the console.

###Slave Window Manager (created by [ags131](https://github.com/ags131/steamMinigameSlaveScript)):
- Allows opening of multiple slave windows to work around the clicks per second limit
- Disables rendering on slave windows in order to reduce memory/cpu use
- In-UI management of slaves from master window
- Automatic refresh of slave windows to avoid any memleaks
- ***Known issue with Slave Window Manager & UserScript:***
    - The Slave Window Manager code seems to get cached by the userscript. You can force a refresh by uninstalling and reinstalling the base userscript. NOTE: Issue being tracked [here](https://github.com/ensingm2/SteamMonsterGameScript/issues/59), if you have any ideas on how to fix it, I'd appreciate a comment.


*There are buttons that get added to the bottom of the game page that toggle these functions for your convenience*

##Variables:
Feel free to edit any variables to suit your needs
###Main
- **debug (default: false):** if true, logs all actions to the console.
- **clicksPerSecond (default: g_TuningData.abilities[1].max_num_clicks):** Number of clicks to be sent to the server each second.
- **autoClickerVariance (default: 10% of clicksPerSecond):** amount that the clicks per second can be randomized by (range is clicksPersecond +/- autoClickerVariance)
- **respawnCheckFreq (default: 5000ms):** Duration (in milliseconds) between checks to see if the player needs to be revived.
- **targetSwapperFreq (default: 1000ms):** Duration (in milliseconds) between checks to see if the player needs to change targets.
- **abilityUseCheckFreq (default: 2000ms):** Duration (in milliseconds) between checks to see if it is beneficial to use an active ability
- **itemUseCheckFreq (default: 5000ms):** Duration (in milliseconds) between checks to see if it is beneficial to use a consumable item
- **upgradeManagerFreq (default: 30000):** Duration (in milliseconds) between checks to see if it is beneficial to purchase an upgrade
- **autoBuyAbilities (default: false):** if true, autoUpgrader will prioritize buying new abilities for use over upgrades.

###Item Use
- **useMedicsAtPercent (default: 30):** % max hp at which to use the medics ability
- **useMedicsAtLanePercent (default: 50):** If average lane health dips below this %, Medics will be used.
- **useMedicsAtLanePercentAliveReq (default: 40):** % of lane allies that must be alive in order to use Medics selflessly
- **useNukeOnSpawnerAbovePercent (default: 75):** Above this % percentage threshold, a nuke will be used on a targeted spawner
- **useMetalDetectorOnBossBelowPercent (default: 30):** Below this % percentage threshold, a Metal Detector will be used on a targeted boss
- **seekHealingPercent (default: 20)** Below this % percentage threshold, script will swap to any lane that has a Healing powerup active
- **useStealHealthAtPercent (default: 15):** % max hp at which to use the Steal Health Item
- **useRainingGoldAbovePercent (default: 75):** Above this % percentage threshold, Raining Gold will be used on a targeted boss
- ** (default: ):** 
- ** (default: ):** 
- **useLikeNewAboveCooldown (default: 14220000):** If total non-item ability cooldown passes this threshold (in milliseconds) and one is available, a Like New will be used.
- **useResurrectToSaveCount (default: 150):** Will use resurrect if over this number of players is dead in your lane.

###Slave Window Settings (NOT CURRENTLY ACCESSABLE)
- **slaveWindowUICleanup (default: true):** Whether or not slave windows will have all graphics removed in order to reduce load.
- **slaveWindowPeriodicRestart (default: true):** If enabled, slave windows will periodically close and reopen in an attempt to cut down on any memory leaks
- **slaveWindowPeriodicRestartInterval (default: 300000 [5 minutes]):** Duration (in milliseconds) between slave window reloads, if slaveWindowPeriodicRestart is set

##Notes:
This script does not output particles for clicks, so you will not see damage output from the autoclicker. This is intended, as it reduces lag and removes a fairly large memory leak in the base game.
You will however see the output from the attacks made by any auto-fire cannons or your own manual clicks, as we haven't altered that code.
See the [Testing](https://github.com/ensingm2/SteamMonsterGameScript#testing) section of this readme if you want to make sure things are working.

##Testing:
If you would like to test the script, you have a few options
- Use a browser add-on such as Firebug for Firefox and view the POST data being sent to the server. This is the best testing method as you can see exactly what's being sent to the server.
- If you're running in chrome and just want to make sure the scripts are running, type "debug=true" into the console, and it will enable debug console logs as things happen.

##Using code from this in your own script?##
Yeah, you're welcome to. It'd be nice of you to give some type of credit to whoever originally added that feature though. Don't worry about it if you're forking from this, in that case there's a trail leading back so people can see the original committers.

##TODO:
- Finish automating use of abilities & items
- Bug Fixes?

##Contributors:
(Listed alphabetically)
- [ags131](https://github.com/ags131)
- [DannyDaemonic](https://github.com/DannyDaemonic)
- [EnragedRabisu](https://github.com/joshho)
- [ensingm2](https://github.com/ensingm2)
- [iareHuuman](https://github.com/iareHuuman)
- [iskandar](https://github.com/iskandar)
- [joshho](https://github.com/joshho)
- [jcugat](https://github.com/jcugat)
- [leandroclem](https://github.com/leandroclem)
- [meishuu](https://github.com/meishuu)
- [waterfoul] (https://github.com/waterfoul)
- [nbadal](https://github.com/nbadal)
- [vanZeben](https://github.com/vanZeben)
- [Zazcallabah](https://github.com/Zazcallabah)
- [/u/kolodz](https://reddit.com/user/kolodz)
- [/u/Landriff](https://reddit.com/user/Landriff)
- [/u/lllillillilll](https://reddit.com/user/lllillillilll)
- [/u/Meishuu](https://reddit.com/user/Meishuu)
- [/u/minusra](https://reddit.com/user/minusra)
- [/u/Scyntrus](https://reddit.com/user/Scyntrus)
- [/u/TheDollarDes](https://reddit.com/user/TheDollarDes)

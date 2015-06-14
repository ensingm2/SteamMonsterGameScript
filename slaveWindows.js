//Slave Window Variables
var slaveWindowUICleanup = true; // Hide all UI and disable rendering for slaves. This will help on CPU and possibly RAM usage
var slaveWindowPeriodicRestart = true; // Periodically restarts slaves in attempts to free memory
var slaveWindowPeriodicRestartInterval = 5 * 60 * 1000;  // Period to restart slaves (In milliseconds)
var slaveDelayBetweenSpawns = 1000; // Delay (in milliseconds) between when each slave will spawn.

//================= Adding slave windows =============================
// See: https://github.com/ags131/steamMinigameSlaveScript

function runMaster()
{
	window.unload = function(){ killAllSlaves(); }
	
	var slavesList = window.slaves = [];
	
	function spawnSlave(){
		var num = slavesList.length;
		var slaveheight = screen.height / 10;
		var params = 'left=0, top='+(num*100)+', width=220, height=100';
		var slave = window.open("http://steamcommunity.com/minigame/towerattack/?slave",'slave'+num, params);
		slavesList.push(slave);
		$J('.slaveWindowCount').text(slavesList.length);
	}
	
	function spawnSlaves(cnt){
		if(typeof cnt == 'object')
			cnt = parseInt(prompt("How many slave windows would you like to open?\n(REMEMBER TO ALLOW POPUPS)", "2"));
		
		if(cnt == 0 || typeof cnt === 'object')
			return;
		
		console.log("spawning " + cnt + " slave windows.");
		
		//Mute Sounds
		WebStorage.SetLocal('minigame_mute', true);
		WebStorage.SetLocal('minigame_mutemusic', true);
		g_AudioManager.m_eleMusic.pause();
	
		for(var i=0;i<cnt;i++)
			setTimeout(spawnSlave, i * slaveDelayBetweenSpawns);
	}
	
	function killAllSlaves(){
		while(slavesList.length) {
			var toKill = slavesList.pop();
			
			if(toKill)
				toKill.close();
		}
		$J('.slaveWindowCount').text(slavesList.length);
	}
	
	var cont = $J('<div>').addClass('slaveManager');

	
	var counterStyle = {
		'position': 'relative',
		'font-weight': 'bold',
		'top': '25px',
		'float': 'right',
		'margin-right': '10px',
		'color': '#FF8585'
	};
	
	var spacerStyle = {
		'float': 'right'
	};
	var mainSpacerStyle = {
		'float': 'right',
		'margin-right': '6px'
	};
	
	var tgt = $J('.game_options .toggle_music_btn:first');
	var killSlavesBtn = $J('<span>').addClass('toggle_music_btn').insertAfter(tgt).click(killAllSlaves).text('Kill Slaves').css(mainSpacerStyle);
	var spawnSlavesBtn = $J('<span>').addClass('toggle_music_btn').insertAfter(killSlavesBtn).click(spawnSlaves).text('Spawn Slaves').css(spacerStyle);
	$J('<span id="slaveCounter">Slaves: <span class="slaveWindowCount">0</span></span>').insertAfter(spawnSlavesBtn).css(counterStyle);

	$J('#slaveCounter').css(counterStyle);
}
function runSlave()
{
	
	if(slaveWindowUICleanup){
		var cleanupPageInter = setInterval(function(){
			if(window.CUI || g_Minigame.m_CurrentScene.m_bRunning)
			{
				clearInterval(cleanupPageInter);
				$J('body > *').hide()
				var cont = $J('body');
				$J('<div>').css({
					'padding-top': '20px',
					'font-family': '"Press Start 2P"',
					'font-size': '32pt'
				})
				.text('Slave')
				.appendTo(cont);
				g_Minigame.Renderer.render = function(){} // Disable rendering. Completely.
			}
		},1000)
	}
	
	if(slaveWindowPeriodicRestart) {
		var resetInterval = setInterval(function () {
			// Only refresh if we're not on a boss / Treasure mob
			var target = getTarget();
			if(target && target.m_data.type != 2 && target.m_data.type != 4 ){
				clearInterval(resetInterval); // Shouldn't need this but meh.
				window.location.href = "./?slave";
			}
			
		}, slaveWindowPeriodicRestartInterval);
	}
	
	//Don't allow slaves to purchase upgrades or use abilities/items
	stopAutoAbilityUser();
	stopAutoItemUser();
	stopAutoUpgradeManager();
}
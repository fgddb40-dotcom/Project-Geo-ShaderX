<!DOCTYPE html>
<script>
    window.geofs = window.geofs || {};
</script>
<script>
    geofs.version = '3.9';
</script>
<script>
    geofs.forcePreferenceResetOnVersionChange = '';
</script>
<script>
    geofs.multiplayerHost = 'https://mps.geo-fs.com';
</script>
<script>
    geofs.MPSMinUpdateDelay = 500;
</script>
<script>
    geofs.MPSMapUpdatePeriod = 10000;
</script>
<script>
    geofs.domain = 'www.geo-fs.com';
</script>
<script>
    geofs.userRoles = {
        "anonymous": 0,
        "authenticated": 1,
        "student": 2,
        "instructor": 3,
        "editor": 11,
        "licenseadmin": 40,
        "subscribed": 80,
        "admin": 100
    };
</script>
<script>
    geofs.masterDomain = 'geo-fs.com';
</script>
<script>
    geofs.scheme = 'https://';
</script>
<script>
    geofs.url = 'https://www.geo-fs.com';
</script>
<script>
    geofs.localUrl = 'https://www.geo-fs.com/';
</script>
<script>
    geofs.multiplayerModelUrl = 'https://www.geo-fs.com';
</script>
<script>
    geofs.googleAppId = '208044912282-4g0gk5oum6gecc2d7ll1ensv921l12us.apps.googleusercontent.com';
</script>
<script>
    geofs.facebookAppId = '404853203195387';
</script>
<script>
    geofs.dataServer = 'https://data.geo-fs.com/';
</script>
<script>
    geofs.srtmServer = 'https://data.geo-fs.com/srtm/';
</script>
<script>
    geofs.blackMarbleServer = 'https://data.geo-fs.com/bm/';
</script>
<script>
    geofs.osmTileProvider = 'https://data.geo-fs.com/osm/{z}/{x}/{y}.png';
</script>
<script>
    geofs.landuseServer = 'https://data.geo-fs.com/landuse/';
</script>
<script>
    geofs.buildingServer = 'https://data.geo-fs.com/buildings/';
</script>
<script>
    geofs.treeServer = 'https://data.geo-fs.com/trees/';
</script>
<script>
    geofs.treeServerExtension = '.glbz';
</script>
<script>
    geofs.objectServer = 'https://data.geo-fs.com/landmarks/';
</script>
<script>
    geofs.weatherServer = 'https://weather.geo-fs.com/';
</script>
<script>
    geofs.ionkey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiMWQ1NWRlMy1lZmM3LTRlNDYtYWQyOS1hZDlmZmMyZGRiZWUiLCJpZCI6NzYsInNjb3BlcyI6WyJhc3IiXSwiYXNzZXRzIjpbMV0sImlhdCI6MTU1MzUwOTAwMX0.AlJJNDP3yr3dOLmcMnuJdsODGrVoSpm9lvtcXuGM99M';
</script>
<script>
    geofs.googleAPIKey = 'AIzaSyAkM_2eRnvbh0Te_MQjbGrQbF1UBDsv5_E';
</script>
<html lang="en">
    <head>
        <title>GeoFS - Fly in Your Web Browser</title>
        <link rel="canonical" href="https://www.geo-fs.com/geofs.php">
        <link rel="shortcut icon" href="/images/icons/favicon.ico"/>
        <link rel='apple-touch-icon' href='/images/icons/apple-touch-icon.png'>
        <meta http-equiv="content-type" content="text/html; charset=utf-8">
        <meta name="description" content="Fly directly in your web browser without anything to download or to install.">
        <meta name="viewport" content="width=device-width, height=device-height, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover">
        <meta property="og:title" content="GeoFS - The Accessible Flight Simulator"/>
        <meta property="og:type" content="game"/>
        <meta property="og:url" content="https://www.geo-fs.com/"/>
        <meta property="og:image" content="https://www.geo-fs.com/images/poster.jpg"/>
        <meta property="og:description" content="Fly for free, directly in your web browser, without anything to download or to install."/>
        <link rel="shortcut icon" href="favicon.ico">
        <script>
            window.eventdone = {};

            window.loadAsyncScript = function(url, onLoadFunction) {
                var script = document.createElement('script');
                script.type = 'text/javascript';
                document.body.appendChild(script);
                script.onload = onLoadFunction;
                script.src = url;
            }
            ;

            window.executeOnEventDone = function(eventName, callback) {
                if (window.eventdone[eventName]) {
                    try {
                        callback();
                    } catch (e) {
                        console.log(e);
                    }
                } else {
                    window.addEventListener(eventName, callback);
                }
            }
            ;

            window.fireBasicEvent = function(eventName) {

                if (typeof (Event) === 'function') {
                    var event = new Event(eventName);
                } else {
                    // IE compatibility
                    var event = document.createEvent('Event');
                    event.initEvent(eventName, true, true);
                }

                window.eventdone[eventName] = true;
                window.dispatchEvent(event);
            }
            ;

            window.addEventListener('load', function() {

                var scripts = document.getElementsByTagName('script');
                var deferredScripts = Array.from(scripts).filter(script => script.getAttribute('data-deferredsrc'));

                function loadDeferredScript(i) {

                    var script = deferredScripts[i];

                    if (i >= deferredScripts.length) {
                        window.fireBasicEvent('deferredload');
                        window.fireBasicEvent('afterDeferredload');
                        return;
                    }

                    script.onload = script.onerror = function() {
                        // load next deferred script
                        loadDeferredScript(i + 1);
                    }
                    ;

                    script.setAttribute("src", script.getAttribute("data-deferredsrc"));
                    script.removeAttribute("data-deferredsrc");
                }

                loadDeferredScript(0);
            });
        </script>
        <!-- Common CSS -->
        <link rel="stylesheet" type="text/css" href="/css/commonCSS.css?kc=24" media="screen"/>
        <!-- Common JS -->
        <script data-deferredsrc="/js/commonJS.js?kc=17"></script>
        <!-- 3rd parties -->
        <!-- Local CESIUM Repo/build -->
        <!--
    <link rel="stylesheet" type="text/css" href="/projects/CESIUM/Build/Cesium/Widgets/widgets.css" media="screen"/>
    <script defer src="/projects/CESIUM/Build/Cesium/Cesium.js" obfuscation="update" dest="js/Cesium/build/Cesium.js"></script>
    -->
        <section version="3.8">
            <!-- 3.8 Resources -->
            <script data-deferredsrc="js/Cesium/build/Cesium.js"></script>
        </section>
        <!-- Sim -->
        <!-- Data -->
        <script data-deferredsrc="/data/runwaygrid.js?k=1"></script>
        <script data-deferredsrc="/data/airports.js"></script>
        <!-- Google tag (gtag.js) -->
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-HB7Z4Z74PE"></script>
        <script>
            window.dataLayer = window.dataLayer || [];
            function gtag() {
                dataLayer.push(arguments);
            }
            gtag('js', new Date());

            gtag('config', 'G-HB7Z4Z74PE');
        </script>
        <script>
            geofs.PRODUCTION = true;
            geofs.killCache = '?kc=1729598422';
        </script>
        <script data-deferredsrc="/js/geofs.js?kc=3910"></script>
        <link rel="stylesheet" type="text/css" href="css/geofs.css?kc=24" media="screen"/>
        <style>
            .mdl-ripple {
                background: #000;
                opacity: 0.001;
            }
        </style>
    </head>
    <body class="geofs geofs-ingame  " style="overflow: hidden; background-color: #25405e;">
        <div class="geofs-ui-center">
            <script>
                geofs.userRecord = {
                    "id": "639896",
                    "email": "devilroyalty666@gmail.com",
                    "googleid": "106095352205907116788",
                    "facebookid": null,
                    "licenseid": null,
                    "deviceid": null,
                    "appleid": null,
                    "externalid": null,
                    "firstname": "Riley",
                    "lastname": "",
                    "callsign": "Test9",
                    "sessionId": "bhs51g5a8r7a2ihmrriuaak6gp",
                    "created": "2022-10-16 23:24:54",
                    "active": "1",
                    "ip": "216.179.119.25",
                    "role": "1",
                    "muted": "23",
                    "banned": "0",
                    "lastlogin": "2026-10-16 14:15:01",
                    "mailing": "1",
                    "password": "***",
                    "flighttime": "3699",
                    "preferences": null,
                    "mutelist": ",828523,",
                    "premium": null,
                    "transactionDate": null,
                    "transactionReference": null,
                    "transactionStatus": "trialexpired",
                    "transactionMessage": null,
                    "subscribed": null,
                    "subscriptionStart": null,
                    "subscriptionEnd": "2026-10-06 23:08:55",
                    "trial": "1",
                    "subscription": null
                };
            </script>
            <script>
                geofs.userRecord.muteList = [828523];
            </script>
            <script>
                geofs.userRecord.muteListMap = {
                    '828523': 1
                };
            </script>
            <div class="geofs-auth geofs-htmlView">
                <a href="/pages/account.php?action=edit" class="mdl-button mdl-js-button geofs-callsign" title="Your account page">
                    Test9 <i class="material-icons">account_circle</i>
                </a>
                <a class="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect geofs-signout geofs-hideForApp">Sign out</a>
            </div>
            <div class="geofs-startModalMobile">
                <h1>Welcome to GeoFS!</h1>
                <p>
                You appear to be using a mobile device, would you like to use mobile optimized settings?
            </p>
                <p style="text-align: center;">
                    <a class="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect geofs-fly-button" style="margin-bottom: 20px; width: 100px;">
                        <i class="material-icons"></i>
                        No
                    </a>
                    <br>
                    <a class="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent geofs-fly-button-mobile" style="width: 100px;">
                        <i class="material-icons"></i>
                        Yes!
                    </a>
                </p>
            </div>
            <div class="geofs-startModal">
                <h1>Welcome to GeoFS!</h1>
                <h5>A quick briefing before take-off:</h5>
                <ul style="margin-left: -25px;">
                    <li>+ and - keys to set throttle</li>
                    <li>You are flying with the mouse (configurable)</li>
                    <li>As you gain speed, gently pull on the stick (mouse down) to take off</li>
                    <li>Press R to reset your flight</li>
                </ul>
                <a class="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent geofs-fly-button">
                    <i class="material-icons"></i>
                    Fly!
                </a>
            </div>
            <div class="geofs-flightSharing-status"></div>
            <div class="geofs-user-dialog">
                <h4 style="white-space: nowrap; flex-grow: 1;">
                    <span class="material-icons" style="font-size: 30px;vertical-align: sub;margin-right: 5px;">perm_identity</span>
                    Pilot <b class="geofs-user-callsign"></b>
                </h4>
                <button class="geofs-ignore-user mdl-button mdl-button--raised mdl-button--colored" title="Block user">
                    <span class="material-icons">pan_tool</span>
                    Block user
                </button>
                <button class="geofs-share-user geofs-school mdl-button mdl-button--raised mdl-button--accent" title="Share flight and controls with user">
                    <span class="material-icons">group</span>
                    Share flight
                </button>
                <button class="geofs-join-user mdl-button mdl-button--raised">
                    <span class="material-icons" title="Join user in flight">call_merge</span>
                    Join user in flight
                </button>
                <button class="geofs-cancel mdl-button close" title="Close">Close</button>
            </div>
            <!-- Top UI overlay -->
            <div class="geofs-ui-top">
                <div class="control-pad geofs-control-status" title="Mouse controls on hold, press [M] to enable.">
                    <div class="control-pad-label orange-pad">MOUSE OFF</div>
                </div>
                <div class="geofs-autopilot-bar">
                    <div class="control-pad geofs-autopilot-pad" title="Toggle autopilot on/off">
                        <div class="control-pad-label transp-pad">AUTOPILOT</div>
                    </div>
                    <div class="geofs-autopilot-controls">
                        <div class="geofs-autopilot-control">
                            <a class="numberDown">-</a>
                            <input class="geofs-autopilot-speed geofs-autopilot-mach" min="0" step="0.01" decimals="2" data-method="setSpeed" maxlength="5" value="0"/>
                            <input class="numberValue geofs-autopilot-speed geofs-autopilot-knots" min="0" smallstep="5" stepthreshold="100" step="10" data-method="setSpeed" maxlength="4" value="0"/>
                            <a class="numberUp">+</a>
                            <span class="geofs-autopilot-switch geofs-speed-mode">
                                <a class="switchLeft green-pad" data-method="setSpeedMode" value="knots">KTS</a>
                                <a class="switchRight" data-method="setSpeedMode" value="mach">M.</a>
                            </span>
                        </div>
                        <div class="geofs-autopilot-control">
                            <a class="numberDown">-</a>
                            <input class="numberValue geofs-autopilot-course" min="0" max="359" data-loop="true" step="1" data-method="setCourse" maxlength="3" value="000"/>
                            <a class="numberUp">+</a>
                            <span class="geofs-autopilot-switch geofs-autopilot-mode">
                                <a class="switchLeft geofs-autopilot-HDG green-pad" data-method="setMode" value="HDG">HDG</a>
                                <a class="switchRight geofs-autopilot-NAV" data-method="setMode" value="NAV">NAV</a>
                            </span>
                        </div>
                        <div class="geofs-autopilot-control">
                            <a class="numberDown">-</a>
                            <input class="numberValue geofs-autopilot-altitude" min="0" max="100000" smallstep="100" stepthreshold="3000" step="500" data-method="setAltitude" maxlength="5" value="00000"/>
                            <a class="numberUp">+</a>
                            <span>ALTITUDE</span>
                        </div>
                        <div class="geofs-autopilot-control">
                            <a class="numberDown">-</a>
                            <input class="numberValue geofs-autopilot-verticalSpeed" min="-6000" max="6000" step="100" data-method="setVerticalSpeed" maxlength="5" value="00000"/>
                            <a class="numberUp">+</a>
                            <span>VERT SPEED</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="geofs-ui-right">
                <!-- Wind Indicator-->
                <div class="geofs-wind-container"></div>
                <!-- Radio box -->
                <div class="geofs-radio-controls">
                    <div class="geofs-radio-control geofs-nav-frequency">
                        <span class="geofs-radio-label">
                            <button class="geofs-radio-select on" name="NAV1MODE" onclick="geofs.nav.setNAVMode('NAV', 'NAV1');">NAV</button>
                            <button class="geofs-radio-select" name="GPSMODE" onclick="geofs.nav.setNAVMode('GPS', 'GPS');">GPS</button>
                        </span>
                        <input class="geofs-radio-display" name="NAVFrequency">
                        <button class="geofs-radio-ident" data-unit="NAV1">ident</button>
                    </div>
                    <div class="geofs-radio-control geofs-radio-OBS">
                        <span class="geofs-radio-label">OBS</span>
                        <input class="geofs-radio-display" name="radioOBS">
                    </div>
                    <div class="geofs-radio-control">
                        <span class="geofs-radio-label">DME</span>
                        <input class="geofs-radio-display" name="dme">
                        <span class="geofs-radio-unit">NM</span>
                        <input class="geofs-radio-display" name="groundSpeed">
                        <span class="geofs-radio-unit">KTS</span>
                        <input class="geofs-radio-display" name="timeToStation">
                        <span class="geofs-radio-unit">MIN</span>
                    </div>
                    <div class="geofs-radio-control geofs-adf-frequency">
                        <span class="geofs-radio-label">ADF</span>
                        <input class="geofs-radio-display" name="ADFFrequency">
                        <button class="geofs-radio-ident" data-unit="ADF">ident</button>
                    </div>
                </div>
                <div class="control-pad geofs-radio-pad" title="Open radio navigation controls">
                    <div class="control-pad-label transp-pad">RADIO</div>
                </div>
                <!-- Control Pads -->
                <div class="geofs-pads-container"></div>
            </div>
            <!-- Canvas placeholder -->
            <div id="geofs-ui-3dview" class="geofs-ui-3dview">
                <div class="geofs-alarms-container"></div>
                <div class="geofs-crashOverlay">
                    You crashed<br>
                    <span class="geofs-hideForMobileDevice">click to reset</span>
                    <span class="geofs-onlyForMobileDevice">tap to reset</span>
                </div>
                <!-- Instrument container -->
                <div class="geofs-instruments-container"></div>
                <div class="geofs-indicators-container"></div>
                <div class="geofs-overlay-container"></div>
                <!-- Touch control pads -->
                <div class="geofs-touch-controls">
                    <div class="geofs-throttle-pad">
                        <div class="geofs-throttle-cursor">
                            <div class="geofs-rudder-pad">
                                <div class="geofs-rudder-cursor"></div>
                            </div>
                        </div>
                    </div>
                    <div class="geofs-control-pad">
                        <!--
                    <div class="geofs-control-option-x"></div>
                    <div class="geofs-control-option-z"></div>
                -->
                        <div class="geofs-control-trimup"></div>
                        <div class="geofs-control-trimdown"></div>
                        <div class="geofs-control-cursor"></div>
                    </div>
                </div>
                <!-- overlayed div to fix Cesium mouse event bug in IE -->
                <div class="geofs-canvas-mousewheel-overlay">
                    <div class="geofs-canvas-mouse-overlay">
                        <div class="geofs-view-pad"></div>
                        <div class="geofs-creditContainer geofs-hideForMobileDevice"></div>
                        <div class="geofs-player-count" data-toggle-panel=".geofs-player-list"></div>
                        <a href="/pages/hd.php" target="_blank">
                            <img data-deferredsrc="/images/sd-logo.png" class="geofs-sd-logo" title="Standard definition: Sentinel-2">
                            <img data-deferredsrc="/images/sr-logo.png" class="geofs-sr-logo" title="Super Resolution: Ai2 Satlas">
                            <img data-deferredsrc="/images/hd-logo.png" class="geofs-hd-logo" title="High Definition: Microsoft Bing">
                            <img data-deferredsrc="/images/hdstar-logo.png" class="geofs-hdstar-logo" title="High Definition: ESRI"/>
                        </a>
                        <!-- Chat section -->
                        <div class="geofs-chat-messages geofs-authenticated geofs-hideForApp"></div>
                    </div>
                </div>
            </div>
            <!-- Bottom bar -->
            <div class="geofs-ui-bottom">
                <!-- Mobile Options button-->
                <button class="mdl-button mdl-js-button mdl-button--icon geofs-f-standard-ui geofs-onlyForMobile" style="margin-left: 10px;" data-toggle-panel=".geofs-preference-list" titlenot="Open the settings/options panel" data-tooltip-classname="mdl-tooltip--top">
                    <i class="material-icons">menu</i>
                </button>
                <!-- Small screen menu -->
                <button id="small_screen_menu" class="mdl-button mdl-js-button mdl-button--icon geofs-smallScreenOnly">
                    <i class="material-icons">more_vert</i>
                </button>
                <!-- Small Screen Menu -->
                <ul class="mdl-menu mdl-menu--top-left mdl-js-menu mdl-js-ripple-effect geofs-smallScreenOnly" for="small_screen_menu">
                    <li class="mdl-menu__item">
                        <!-- Pause, mute, reset -->
                        <div class="geofs-ui-bottom-box geofs-f-standard-ui">
                            <button class="geofs-button-pause mdl-button mdl-js-button mdl-button--icon" onclick="geofs.togglePause();" title="Pause/Unpause [P]">
                                <i class="material-icons">pause_circle_outline</i>
                            </button>
                            <button class="geofs-button-mute mdl-button mdl-js-button mdl-button--icon" onclick="audio.toggleMute();" title="Mute/Unmute sound [S]">
                                <i class="material-icons">volume_off</i>
                            </button>
                            <button class="geofs-button-visibility mdl-button mdl-js-button mdl-button--icon" onclick="geofs.visibilityCycle();" title="Cycle UI visibility [H]">
                                <i class="material-icons">visibility</i>
                            </button>
                            <button class="mdl-button mdl-js-button mdl-button--icon" onclick="geofs.resetFlight();" title="Reset the flight [R]">
                                <i class="material-icons">autorenew</i>
                            </button>
                            <button class="mdl-button mdl-js-button mdl-button--icon" data-tooltip-classname="mdl-tooltip--top" onclick="flight.recorder.enterPlayback();" title="Watch recorded flight [V]">
                                <i class="material-icons">play_circle_outline</i>
                            </button>
                        </div>
                    </li>
                    <li class="mdl-menu__item">
                        <button class="mdl-button mdl-js-button geofs-f-standard-ui geofs-hideForMobile" data-toggle-panel=".geofs-preference-list" title="Open the settings/options panel [O]">
                            <i class="material-icons">settings</i>
                            Options
                        </button>
                    </li>
                    <li class="mdl-menu__item">
                        <button class="mdl-button mdl-js-button geofs-f-standard-ui" data-toggle-panel=".geofs-map-list" title="Navigation charts [N]">
                            <i class="material-icons">explore</i>
                            Nav
                        </button>
                    </li>
                    <li class="mdl-menu__item geofs-hideForApp">
                        <button class="geofs-button-fullscreen mdl-button mdl-js-button geofs-f-standard-ui" onclick="ui.toggleFullscreen();" style="float: right;" data-tooltip-classname="mdl-tooltip--top" title="Toggle fullscreen">
                            <span class="material-icons geofs-fullscreenIconOpen">open_in_full</span>
                            <span class="material-icons geofs-fullscreenIconClose">close_fullscreen</span>
                            Fullscreen
                
                        </button>
                    </li>
                </ul>
                <!-- Full size menu -->
                <!-- Main panels toggle buttons -->
                <button class="mdl-button mdl-js-button geofs-f-standard-ui" data-toggle-panel=".geofs-aircraft-list">Aircraft</button>
                <button class="mdl-button mdl-js-button mdl-button--colored geofs-authenticated geofs-editor-role geofs-f-standard-ui geofs-bigScreenOnly" data-toggle-panel=".geofs-debug">Debug</button>
                <button class="mdl-button mdl-js-button geofs-f-standard-ui" data-toggle-panel=".geofs-location-list">Location</button>
                <!--
            *
            *
            * Camera selector
            *
            *
        -->
                <button id="geofs-camera-selector" class="mdl-button mdl-js-button">Camera</button>
                <ul class="mdl-menu mdl-menu--top-left mdl-js-menu mdl-js-ripple-effect" for="geofs-camera-selector">
                    <li class="geofs-extra-views mdl-menu__item mdl-menu__item--full-bleed-divider">
                        Extra views
                <ul class="mdl-menu geofs-extra-views-holder">
                    <!-- to be filled from aircraft definition -->
                </ul>
                    </li>
                    <li class="mdl-menu__item" data-camera="0">Follow cam</li>
                    <li class="mdl-menu__item" data-camera="1">Cockpit cam</li>
                    <li class="mdl-menu__item" data-camera="2">Cockpit-less cam</li>
                    <li class="mdl-menu__item" data-camera="3">Chase cam</li>
                    <li class="mdl-menu__item" data-camera="4">Free cam</li>
                    <li class="mdl-menu__item mdl-menu__item--full-bleed-divider" data-camera="5">Fixed cam</li>
                    <li class="mdl-menu__item" data-camera="-1">Reset</li>
                </ul>
                <!-- Options and map -->
                <button class="mdl-button mdl-js-button geofs-f-standard-ui geofs-hideForMobile" data-toggle-panel=".geofs-preference-list" title="Open the settings/options panel [O]" data-tooltip-classname="mdl-tooltip--top">
                    Options <i class="material-icons geofs-ui-bottom-icon">settings</i>
                </button>
                <button class="mdl-button mdl-js-button geofs-f-standard-ui" data-toggle-panel=".geofs-map-list" title="Open the navigation panel [N]" data-tooltip-classname="mdl-tooltip--top">
                    Nav <i class="material-icons geofs-ui-bottom-icon">explore</i>
                </button>
                <!--
        <button class="geofs-button-vr mdl-button mdl-js-button geofs-f-standard-ui geofs-editor-role" onclick="ui.vr.toggle();" data-tooltip-classname="mdl-tooltip--top" title="Toggle VR"><img src="/images/vr-icon.png"/></button>
-->
                <button class="geofs-button-fullscreen mdl-button mdl-js-button geofs-f-standard-ui geofs-hideForApp" onclick="ui.toggleFullscreen();" style="float: right;" data-tooltip-classname="mdl-tooltip--top" title="Toggle fullscreen">
                    <span class="material-icons geofs-fullscreenIconOpen">open_in_full</span>
                    <span class="material-icons geofs-fullscreenIconClose">close_fullscreen</span>
                </button>
                <!-- Pause, mute, reset, playback -->
                <div class="geofs-ui-bottom-box geofs-f-standard-ui">
                    <button class="geofs-button-pause mdl-button mdl-js-button mdl-button--icon" data-tooltip-classname="mdl-tooltip--top" onclick="geofs.togglePause();" title="Pause/Unpause [P]">
                        <i class="material-icons">pause_circle_outline</i>
                    </button>
                    <button class="geofs-button-mute mdl-button mdl-js-button mdl-button--icon" data-tooltip-classname="mdl-tooltip--top" onclick="audio.toggleMute();" title="Mute/Unmute sound [S]">
                        <i class="material-icons">volume_off</i>
                    </button>
                    <button class="geofs-button-visibility mdl-button mdl-js-button mdl-button--icon" data-tooltip-classname="mdl-tooltip--top" onclick="geofs.visibilityCycle();" title="Cycle UI visibility [H]">
                        <i class="material-icons">visibility</i>
                    </button>
                    <button class="mdl-button mdl-js-button mdl-button--icon" data-tooltip-classname="mdl-tooltip--top" onclick="geofs.resetFlight();" title="Reset the flight [R]">
                        <i class="material-icons">autorenew</i>
                    </button>
                    <button class="mdl-button mdl-js-button mdl-button--icon" data-tooltip-classname="mdl-tooltip--top" onclick="flight.recorder.enterPlayback();" title="Watch recorded flight [V]">
                        <i class="material-icons">play_circle_outline</i>
                    </button>
                </div>
                <button class="mdl-button mdl-js-button geofs-authenticated mdl-button--icon geofs-f-standard-ui" data-tooltip-classname="mdl-tooltip--top" data-toggle-panel=".geofs-player-list" title="List of online pilots">
                    <i class="material-icons">group</i>
                </button>
                <!-- Chat -->
                <div class="geofs-chat-input-section geofs-authenticated geofs-f-standard-ui geofs-bigScreenOnly geofs-hideForMobile">
                    <button class="geofs-chat-button mdl-button mdl-js-button" data-tooltip-classname="mdl-tooltip--top" title="Type a chat message [T]">
                        Talk <i class="icon-align-left"></i>
                    </button>
                    <form class="geofs-chat-form">
                        <div class="mdl-textfield mdl-js-textfield">
                            <input class="mdl-textfield__input geofs-chat-input geofs-stopKeyboardPropagation geofs-stopKeyupPropagation geofs-stopMousePropagation" size="30" maxlength="70" type="text" id="chatInput">
                            <label class="mdl-textfield__label" for="chatInput">Message...</label>
                        </div>
                        <button class="geofs-chat-send-button mdl-button mdl-js-button mdl-button--colored" type="submit">Send</button>
                    </form>
                </div>
                <button class="mdl-button mdl-js-button geofs-f-standard-ui geofs-hd-button geofs-onlyForApp">
                    <i class="material-icons">hd</i>
                </button>
                <button class="mdl-button mdl-js-button mdl-button--icon geofs-f-standard-ui geofs-orientationReset" data-tooltip-classname="mdl-tooltip--top" title="Reset orientation controls to neutral">
                    <i class="material-icons">adjust</i>
                </button>
                <!--
            *
            *
            * Record player
            *
            *
        -->
                <div class="geofs-f-recordPlayer">
                    <a class="mdl-button mdl-js-button geofs-screenshot" download="geofs.jpg" href="" onclick="geofs.api.takeCanvasScreenShot(this);" data-tooltip-classname="mdl-tooltip--top" title="Canvas Screenshot">
                        <span class="material-icons">photo_camera</span>
                    </a>
                    <button class="mdl-button mdl-js-button" onclick="flight.recorder.exitPlayback();" data-tooltip-classname="mdl-tooltip--top" title="Exit record player">Exit player</button>
                    <!-- Player controls -->
                    <div class="geofs-ui-bottom-box">
                        <label style="padding: 0px;" class="mdl-button mdl-js-button mdl-button--icon" data-tooltip-classname="mdl-tooltip--top" title="Open recorded flight (JSON)" for="flightfileupload">
                            <i class="material-icons">folder_open</i>
                        </label>
                        <a style="padding: 0px;" class="mdl-button mdl-js-button mdl-button--icon" data-tooltip-classname="mdl-tooltip--top" title="Save recorded flight" onclick="flight.recorder.download(this);">
                            <i class="material-icons">save</i>
                        </a>
                        <input type="file" id="flightfileupload" style="display: none;" onchange="flight.recorder.upload(this);">
                        <!--<button class="mdl-button mdl-js-button mdl-button--icon" onclick="flight.recorder.setStep(0, 'set');" data-tooltip-classname="mdl-tooltip--top" title="Begining"><i class="material-icons">fast_rewind</i></button>-->
                        <button class="mdl-button mdl-js-button mdl-button--icon" onclick="flight.recorder.startPlayback();" data-tooltip-classname="mdl-tooltip--top" title="Start playback">
                            <i class="material-icons">play_arrow</i>
                        </button>
                        <button class="geofs-button-pause mdl-button mdl-js-button mdl-button--icon" onclick="geofs.togglePause();" data-tooltip-classname="mdl-tooltip--top" title="Pause/Unpause playback [P]">
                            <i class="material-icons">pause</i>
                        </button>
                        <!--<button class="mdl-button mdl-js-button mdl-button--icon" onclick="flight.recorder.setStep(100000, 'set');" data-tooltip-classname="mdl-tooltip--top" title="End"><i class="material-icons">fast_forward</i></button>-->
                    </div>
                </div>
                <!-- player slider -->
                <div class="geofs-f-recordPlayer geofs-slider-container">
                    <div class="slider geofs-recordPlayer-slider" data-type="slider" value="0" data-min="0" data-precision="0" style="height: 10px;">
                        <div class="slider-rail">
                            <div class="slider-selection">
                                <div class="slider-grippy">
                                    <input class="slider-input">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="geofs-ui-left">
            <div class="geofs-apiResponse"></div>
            <ul class="geofs-list geofs-toggle-panel geofs-preference-list geofs-preferences" data-noblur="true" data-onshow="{geofs.initializePreferencesPanel()}" data-onhide="{geofs.savePreferencesPanel()}">
                <fieldset style="margin: 15px 0px 0px 10px;" class="geofs-onlyForMobileDevice geofs-hideForApp">
                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="mobileSettings" title="Mobile Optimized Settings">
                        <input type="checkbox" id="mobileSettings" class="mdl-switch__input" data-gespref="geofs.preferences.mobile" data-update="{geofs.mobile.setMobileMode()}">
                        <span class="mdl-switch__label">Mobile Optimized Settings</span>
                    </label>
                </fieldset>
                <li class="geofs-list-collapsible-item">
                    General

        
                    <div class="geofs-collapsible">
                        <fieldset>
                            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect geofs-hideForMobile" for="transparentUi" title="Toggle transparent User Interface">
                                <input type="checkbox" id="transparentUi" class="mdl-switch__input" data-gespref="geofs.preferences.interface.transparent" data-update="{ui.applyPreferences()}">
                                <span class="mdl-switch__label">Transparent User Interface</span>
                            </label>
                            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect geofs-hideForMobile" for="yokeCursor" title="Toggle transparent User Interface">
                                <input type="checkbox" id="yokeCursor" class="mdl-switch__input" data-gespref="geofs.preferences.interface.showYokeCursor" data-update="{ui.applyPreferences()}">
                                <span class="mdl-switch__label">Show yoke mouse cursor (more visible)</span>
                            </label>
                            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="crashDetection" title="Enable crash detection">
                                <input type="checkbox" id="crashDetection" class="mdl-switch__input" data-gespref="geofs.preferences.crashDetection">
                                <span class="mdl-switch__label">Detect crashes</span>
                            </label>
                            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="headMotion" title="Enable head acceleration motion">
                                <input type="checkbox" id="headMotion" class="mdl-switch__input" data-gespref="geofs.preferences.camera.headMotion">
                                <span class="mdl-switch__label">Cockpit view head motion</span>
                            </label>
                            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="followMotion" title="Enable oustide view camera motion">
                                <input type="checkbox" id="followMotion" class="mdl-switch__input" data-gespref="geofs.preferences.camera.followMotion">
                                <span class="mdl-switch__label">Outside view camera motion</span>
                            </label>
                            <!--
                <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="circuits" title="Show Circuit over runways">
                    <input type="checkbox" id="circuits" class="mdl-switch__input" data-gespref="geofs.preferences.circuits" data-update="{geofs.runways.setCircuitVisibility(this.checked)}">
                    <span class="mdl-switch__label">Show Runway Circuits</span>
                </label>
-->
                        </fieldset>
                        <fieldset>
                            <legend>
                                <a href="https://dispatch.simbrief.com/home" target="_blank" rel="nofollow">
                                    <img data-deferredsrc="/images/simbrieflogo.png" style="float: left; margin-right: 10px; margin-top: 4px;"/>
                                </a>
                            </legend>
                            If you have a <a href="https://dispatch.simbrief.com/home" target="_blank" rel="nofollow">Navigraph SimBrief</a>
                            account, enter your username here to be able to import your latest flight plan directly into GeoFS.
                
                            <div class="mdl-textfield mdl-js-textfield">
                                <input class="mdl-textfield__input" type="text" data-gespref="geofs.preferences.simBriefUsername" id="simBriefUsername">
                                <label class="mdl-textfield__label" for="sample1">SimBrief Alias/Username</label>
                            </div>
                        </fieldset>
                        <fieldset class="geofs-hideForApp">
                            <legend>
                    Multi-monitor
                </legend>
                            <button class="mdl-button mdl-js-button mdl-button--raised" onclick="geofs.camera.openSlaveWindow(-1);" title="Extend screen to the left">
                    Open left screen
                </button>
                            <button class="mdl-button mdl-js-button mdl-button--raised" style="float: right;" onclick="geofs.camera.openSlaveWindow(1);" title="Extend screen to the right">
                    Open right screen
                </button>
                            <div title="Quality Level" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.slaveQuality" value="3" data-min="1" data-max="6" data-precision="0">
                                <div class="slider-rail">
                                    <div class="slider-selection">
                                        <div class="slider-grippy">
                                            <input class="slider-input"/>
                                        </div>
                                    </div>
                                </div>
                                <label>Slave window quality</label>
                            </div>
                        </fieldset>
                        <fieldset>
                            <legend>
                    Sound Volume
                </legend>
                            <div title="Sound Volume" class="slider" data-type="slider" data-gespref="geofs.preferences.volume" data-update="{audio.soundplayer.setMasterVolume()}" value="1" data-min="0" data-max="1" data-precision="2">
                                <div class="slider-rail">
                                    <div class="slider-selection">
                                        <div class="slider-grippy">
                                            <input class="slider-input"/>
                                        </div>
                                    </div>
                                </div>
                                <label>Volume</label>
                            </div>
                        </fieldset>
                        <fieldset class="geofs-hideForApp">
                            <!-- Colored mini FAB button -->
                            <button class="mdl-button mdl-js-button mdl-button--raised " onclick="geofs.getLink();" title="Get a URL to the current flight and location">
                    Generate a link to the current location
                </button>
                            <div class="geofs-linkOutput"></div>
                        </fieldset>
                    </div>
                </li>
                <li class="geofs-list-collapsible-item geofs-preference-controls">
                    Controls

        
                    <ul class="geofs-list geofs-collapsible">
                        <!-- Controls -->
                        <li>Select a control device and configure it.</li>
                        <li class="no-hover geofs-list-collapsible-item geofs-hideForApp">
                            <label class="mdl-radio mdl-js-radio mdl-js-ripple-effect geofs-stopMousePropagation geofs-expendable-radio" for="control-keyboard">
                                <input type="radio" id="control-keyboard" class="mdl-radio__button" name="control" data-update="{controls.setMode(value)}" data-gespref="geofs.preferences.controlMode" data-matchvalue="keyboard"/>
                                <span class="mdl-radio__label">Keyboard [K]
                    </span>
                            </label>
                            configure
                
                            <div class="geofs-collapsible">
                                <fieldset>
                                    <legend>
                            Settings
                        </legend>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="keyboardMixYawRoll" title="Mixes the rudder with the ailerons input">
                                        <input type="checkbox" id="keyboardMixYawRoll" class="mdl-switch__input" data-gespref="geofs.preferences.keyboard.mixYawRoll" data-update="{controls.setMode()}">
                                        <span class="mdl-switch__label">Mix Roll/Yaw</span>
                                    </label>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="keyboardSteerWithRoll" title="Assign ground steering to ailerons as well as rudder input">
                                        <input type="checkbox" id="keyboardSteerWithRoll" class="mdl-switch__input" data-gespref="geofs.preferences.keyboard.steerWithRoll" data-update="{controls.setMode()}">
                                        <span class="mdl-switch__label">Ground steering with roll input</span>
                                    </label>
                                    <div title="Sets how quickly the input responds" class="slider" data-type="slider" data-gespref="geofs.preferences.keyboard.sensitivity" data-update="{controls.setMode()}" value="0" data-min="0.1" data-max="4" data-precision="1">
                                        <div class="slider-rail">
                                            <div class="slider-selection">
                                                <div class="slider-grippy">
                                                    <input class="slider-input"/>
                                                </div>
                                            </div>
                                        </div>
                                        <label>Sensitivity</label>
                                    </div>
                                    <!--
                        <br/>Exponential: <div data-max="2" class="geofs-ui-slider" data-gespref="geofs.preferences.keyboard.exponential" ></div>
                        -->
                                </fieldset>
                                <fieldset>
                                    <legend>
                            Keys
                        </legend>
                                    <div class="geofs-keyboard-keys-container">
                            <!-- pouplated by javascript - preferences.js-->
                        </div>
                                </fieldset>
                            </div>
                        </li>
                        <li class="no-hover geofs-list-collapsible-item geofs-hideForApp">
                            <label class="mdl-radio mdl-js-radio mdl-js-ripple-effect geofs-stopMousePropagation geofs-expendable-radio" for="control-mouse">
                                <input type="radio" id="control-mouse" class="mdl-radio__button" name="control" data-update="{controls.setMode(value)}" data-gespref="geofs.preferences.controlMode" data-matchvalue="mouse"/>
                                <span class="mdl-radio__label">Mouse [M]</span>
                            </label>
                            configure
                
                            <div class="geofs-collapsible">
                                <fieldset>
                                    <legend>
                            Settings
                        </legend>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="mouseMixYawRoll" title="Mixes the rudder with the ailerons input">
                                        <input type="checkbox" id="mouseMixYawRoll" class="mdl-switch__input" data-gespref="geofs.preferences.mouse.mixYawRoll" data-update="{controls.setMode()}">
                                        <span class="mdl-switch__label">Mix Roll/Yaw</span>
                                    </label>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="mouseSteerWithRoll" title="Assign ground steering to ailerons as well as rudder input">
                                        <input type="checkbox" id="mouseSteerWithRoll" class="mdl-switch__input" data-gespref="geofs.preferences.mouse.steerWithRoll" data-update="{controls.setMode()}">
                                        <span class="mdl-switch__label">Ground steering with roll input</span>
                                    </label>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="mouseReverse" title="Reverse Mouse Pitch Control (Up to pull, down to push)">
                                        <input type="checkbox" id="mouseReverse" class="mdl-switch__input" data-gespref="geofs.preferences.mouse.reverse" data-update="{controls.setMode()}">
                                        <span class="mdl-switch__label">Reverse Pitch</span>
                                    </label>
                                    <div title="Sets how quickly the input responds" class="slider" data-type="slider" data-gespref="geofs.preferences.mouse.sensitivity" data-update="{controls.setMode()}" value="0" data-min="0.1" data-max="2" data-precision="1">
                                        <div class="slider-rail">
                                            <div class="slider-selection">
                                                <div class="slider-grippy">
                                                    <input class="slider-input"/>
                                                </div>
                                            </div>
                                        </div>
                                        <label>Sensitivity</label>
                                    </div>
                                </fieldset>
                            </div>
                        </li>
                        <li class="no-hover geofs-list-collapsible-item">
                            <label class="mdl-radio mdl-js-radio mdl-js-ripple-effect geofs-stopMousePropagation geofs-expendable-radio" for="control-joystick">
                                <input type="radio" id="control-joystick" class="mdl-radio__button" name="control" data-update="{controls.setMode(value)}" data-gespref="geofs.preferences.controlMode" data-matchvalue="joystick"/>
                                <span class="mdl-radio__label geofs-hideForMobile">Joystick [J]</span>
                                <span class="mdl-radio__label geofs-onlyForMobile">Gamepad</span>
                            </label>
                            configure
                
                            <div class="geofs-collapsible geofs-preferences-joystick">
                                <fieldset class="geofs-preferences-joystick-status">
                                    <legend>
                            Detected Device(s)
                        </legend>
                                    <div class="alert alert-error">
                                        <b style="color: red;">Your browser does not appear to support the native GamePad API</b>
                                    </div>
                                    <div class="alert alert-warning">
                                        <b>Joystick not detected:</b>
                                        press a button on the Joystick to enable it.
                        
                                    </div>
                                    <div class="alert alert-success"></div>
                                </fieldset>
                                <fieldset>
                                    <legend>
                            Settings
                        </legend>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="joystickMixYawRoll" title="Mixes the rudder with the ailerons input">
                                        <input type="checkbox" id="joystickMixYawRoll" class="mdl-switch__input" data-gespref="geofs.preferences.joystick.mixYawRoll" data-update="{controls.setMode()}">
                                        <span class="mdl-switch__label">Mix Roll/Yaw</span>
                                    </label>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="joystickSteerWithRoll" title="Assign ground steering to ailerons as well as rudder input">
                                        <input type="checkbox" id="joystickSteerWithRoll" class="mdl-switch__input" data-gespref="geofs.preferences.joystick.steerWithRoll" data-update="{controls.setMode()}">
                                        <span class="mdl-switch__label">Ground steering with roll input</span>
                                    </label>
                                    <div title="Sets how quickly the input responds" class="slider" data-type="slider" data-gespref="geofs.preferences.joystick.sensitivity" data-update="{controls.setMode()}" value="0" data-min="0.1" data-max="2" data-precision="1">
                                        <div class="slider-rail">
                                            <div class="slider-selection">
                                                <div class="slider-grippy">
                                                    <input class="slider-input"/>
                                                </div>
                                            </div>
                                        </div>
                                        <label>Sensitivity</label>
                                    </div>
                                </fieldset>
                                <fieldset>
                                    <legend>
                            Axes
                        </legend>
                                    <div class="geofs-joystick-calibration" style="position: relative;">
                                        <!--
                                <button class="mdl-button mdl-js-button mdl-button--raised geofs-joystick-startCalibration" style="position: absolute; right: 10px; top: -15px;" onclick="controls.joystick.startCalibration();" title="Joystick calibration">Calibrate</button>
                            -->
                                        <div class="geofs-preferences-comment geofs-calibrating" style="display: none; color: #ab8000;">
                                            Calibrating: move all axes to full range of motion (<span class="geofs-joystick-calibrationProgress" style="font-weight: bold;"></span>
                                            )
                                        </div>
                                        <div class="geofs-preferences-comment geofs-calibrated">Move the joystick to check activity</div>
                                    </div>
                                    <div class="geofs-joystick-axes-container">
                            <!-- Populated by javascript - preferences.js -->
                        </div>
                                </fieldset>
                                <fieldset>
                                    <legend>
                            Buttons
                        </legend>
                                    <div class="geofs-preferences-comment">
                            Press joystick buttons to check activity
                        </div>
                                    <div class="geofs-joystick-button-container">
                            <!-- Populated by javascript - preferences.js -->
                        </div>
                                </fieldset>
                            </div>
                        </li>
                        <li class="no-hover geofs-list-collapsible-item geofs-preferences-orientation geofs-onlyForMobile">
                            <label class="mdl-radio mdl-js-radio mdl-js-ripple-effect geofs-stopMousePropagation geofs-expendable-radio" for="control-orientation">
                                <input type="radio" id="control-orientation" class="mdl-radio__button" name="control" onclick="controls.orientation.requestIOSPermission()" data-update="{controls.setMode(value)}" data-gespref="geofs.preferences.controlMode" data-matchvalue="orientation"/>
                                <span class="mdl-radio__label">Orientation
                    </span>
                            </label>
                            configure
                
                            <div class="geofs-collapsible">
                                <fieldset>
                                    <legend>
                            Settings
                        </legend>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="orientationMixYawRoll" title="Mixes the rudder with the ailerons input">
                                        <input type="checkbox" id="orientationMixYawRoll" class="mdl-switch__input" data-gespref="geofs.preferences.orientation.mixYawRoll" data-update="{controls.setMode()}">
                                        <span class="mdl-switch__label">Mix Roll/Yaw</span>
                                    </label>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="orientationSteerWithRoll" title="Assign ground steering to ailerons as well as rudder input">
                                        <input type="checkbox" id="orientationSteerWithRoll" class="mdl-switch__input" data-gespref="geofs.preferences.orientation.steerWithRoll" data-update="{controls.setMode()}"/>
                                        <span class="mdl-switch__label">Ground steering with roll input</span>
                                    </label>
                                    <div title="Sets how quickly the input responds" class="slider" data-type="slider" data-gespref="geofs.preferences.orientation.sensitivity" data-update="{controls.setMode()}" value="0" data-min="0.1" data-max="2" data-precision="1">
                                        <div class="slider-rail">
                                            <div class="slider-selection">
                                                <div class="slider-grippy">
                                                    <input class="slider-input"/>
                                                </div>
                                            </div>
                                        </div>
                                        <label>Sensitivity</label>
                                    </div>
                                </fieldset>
                                <fieldset style="float: left;">
                                    <legend>
                            Axis
                        </legend>
                                    <div class="geofs-preferences-comment">
                            Move the device to check activity.
                        </div>
                                    <div class="geofs-feedback-wrapper">
                                        <label>Pitch</label>
                                        <select data-gespref="geofs.preferences.orientation.axis.pitch">
                                            <option value="none">None</option>
                                            <option value="0">Axis 0</option>
                                            <option value="1">Axis 1</option>
                                        </select>
                                        <div class="progress" axis="pitch" centered="true">
                                            <div class="bar"></div>
                                        </div>
                                        <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="reverseOrientationPitch" title="Inverse axis">
                                            <input type="checkbox" id="reverseOrientationPitch" class="mdl-switch__input" data-gespref="geofs.preferences.orientation.multiplier.pitch" data-update="{controls.setMode()}">
                                            <span class="mdl-switch__label">Inverse</span>
                                        </label>
                                    </div>
                                    <div class="geofs-feedback-wrapper">
                                        <label>Roll</label>
                                        <select data-gespref="geofs.preferences.orientation.axis.roll">
                                            <option value="none">None</option>
                                            <option value="0">Axis 0</option>
                                            <option value="1">Axis 1</option>
                                        </select>
                                        <div class="progress" axis="roll" centered="true">
                                            <div class="bar"></div>
                                        </div>
                                        <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="reverseOrientationRoll" title="Inverse axis">
                                            <input type="checkbox" id="reverseOrientationRoll" class="mdl-switch__input" data-gespref="geofs.preferences.orientation.multiplier.roll" data-update="{controls.setMode()}">
                                            <span class="mdl-switch__label">Inverse</span>
                                        </label>
                                    </div>
                                </fieldset>
                                <div class="geofs-orientationReset geofs-orientationCalibratePerm" style="float: left; margin-top: 0px; display: inline-block; position: relative;">
                                    <i class="material-icons md-48">
                            adjust
                        </i>
                                    <br/>Tap to center controls
                    
                                </div>
                            </div>
                        </li>
                        <li class="no-hover geofs-list-collapsible-item geofs-preferences-touch geofs-onlyForMobile">
                            <label class="mdl-radio mdl-js-radio mdl-js-ripple-effect geofs-stopMousePropagation geofs-expendable-radio" for="control-touch">
                                <input type="radio" id="control-touch" class="mdl-radio__button" name="control" data-update="{controls.setMode(value)}" data-gespref="geofs.preferences.controlMode" data-matchvalue="touch"/>
                                <span class="mdl-radio__label">Touch Stick
                    </span>
                            </label>
                            configure
                
                            <div class="geofs-collapsible">
                                <fieldset>
                                    <legend>
                            Settings
                        </legend>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="touchMixYawRoll" title="Mixes the rudder with the ailerons input">
                                        <input type="checkbox" id="touchMixYawRoll" class="mdl-switch__input" data-gespref="geofs.preferences.touch.mixYawRoll" data-update="{controls.setMode()}">
                                        <span class="mdl-switch__label">Mix Roll/Yaw</span>
                                    </label>
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="touchSteerWithRoll" title="Assign ground steering to ailerons as well as rudder input">
                                        <input type="checkbox" id="touchSteerWithRoll" class="mdl-switch__input" data-gespref="geofs.preferences.touch.steerWithRoll" data-update="{controls.setMode()}"/>
                                        <span class="mdl-switch__label">Ground steering with roll input</span>
                                    </label>
                                    <div title="Sets how quickly the input responds" class="slider" data-type="slider" data-gespref="geofs.preferences.touch.sensitivity" data-update="{controls.setMode()}" value="0" data-min="0.01" data-max="1" data-precision="2">
                                        <div class="slider-rail">
                                            <div class="slider-selection">
                                                <div class="slider-grippy">
                                                    <input class="slider-input"/>
                                                </div>
                                            </div>
                                        </div>
                                        <label>Sensitivity</label>
                                    </div>
                                </fieldset>
                            </div>
                        </li>
                    </ul>
                </li>
                <li class="geofs-list-collapsible-item geofs-multiplayer-preferences">
                    Multiplayer

        
                    <div class="geofs-collapsible">
                        <!-- Multiplayer -->
                        <fieldset>
                            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="enableMultiplayer" title="Enable multiplayer">
                                <input type="checkbox" id="enableMultiplayer" class="mdl-switch__input" data-gespref="geofs.preferences.multiplayer" data-update="{if (this.checked) {multiplayer.start();} else {multiplayer.stop();}}"/>
                                <span class="mdl-switch__label">Enable multiplayer</span>
                            </label>
                            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect geofs-hideForSchool" for="showCommunityMultiplayer" title="Show Community Contributed Aircraft">
                                <input type="checkbox" id="showCommunityMultiplayer" class="mdl-switch__input" data-gespref="geofs.preferences.showCommunityMultiplayer"/>
                                <span class="mdl-switch__label">Show Community Contributed 3D Models </span>
                                <i style="margin-top: -9px;position: absolute;margin-left: 23px;display: block;font-size: 12px;">Performance/stability not guaranteed</i>
                            </label>
                            <!--
                <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="enableADSB" title="Enable ADS-B Traffic">
                    <input type="checkbox" id="enableADSB" class="mdl-switch__input" disabled="true" data-gespref="geofs.preferences.adsb" />
                    <span class="mdl-switch__label"><b>INOP </b><i style="color: #888; text-decoration-line: line-through;">Show ADS-B commercial traffic</i></span>
                </label>
                -->
                            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="enableADSB" title="Enable ADS-B Traffic">
                                <input type="checkbox" id="enableADSB" class="mdl-switch__input" data-gespref="geofs.preferences.adsb"/>
                                <span class="mdl-switch__label">Show ADS-B commercial traffic</span>
                            </label>
                            <span class="geofs-hideForApp geofs-hideForSchool" style="display: inline-block; margin: 10px 0px 25px 0px;">
                                <a href="https://disboard.org/servers/tag/geofs?sort=-member_count" target="_blank" rel="nofollow">
                                    <img data-deferredsrc="/images/discord.png" style="margin: 10px 10px 10px 0px;"/>
                                </a>
                                For voice communication and community events, join one of the many <a href="https://disboard.org/servers/tag/geofs?sort=-member_count" target="_blank" rel="nofollow">GeoFS related Discord servers listed on Disboard.org</a>
                            </span>
                            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect geofs-hideForApp geofs-authenticated" for="enableChat" title="Enable text chat">
                                <input type="checkbox" id="enableChat" class="mdl-switch__input geofs-enabledWhenAuthenticated" data-gespref="geofs.preferences.chat" data-update="{ui.chat.visibility();}"/>
                                <span class="mdl-switch__label geofs-hideForSchool">Enable text chat (I am over 13)</span>
                                <span class="mdl-switch__label geofs-onlyForSchool">Enable text chat</span>
                            </label>
                            <i class="geofs-hideForApp geofs-hideForSchool geofs-authenticated">
                                By enabling GeoFS chat, you confirm that you are more than 13 year old.<br/>
                            </i>
                            <i class="geofs-loggedout geofs-hideForApp geofs-hideForSchool">
                                You must be logged in to use the chat<br/>
                            </i>
                            <i class="geofs-hideForApp geofs-hideForSchool geofs-authenticated">
                                <b>
                                    The chat is self moderated: please stay courteous.<br/>If you do not feel comfortable with this, please keep the chat off.
                                </b>
                                <br/>
                            </i>
                            <i class="geofs-hideForApp geofs-hideForSchool geofs-authenticated">
                                <b>Never exchange private information on the chat.</b>
                                <br/>
                            </i>
                        </fieldset>
                    </div>
                </li>
                <li class="geofs-list-collapsible-item">
                    Graphics

        
                    <div class="geofs-collapsible">
                        <!-- Graphics -->
                        <fieldset>
                            <legend class="geofs-hideForMobile">
                    Performance vs. Quality - Anything above 3 requires a fast computer
                </legend>
                            <legend class="geofs-onlyForMobile">
                    Performance vs. Quality - (resolution, viewing distance, ...)
                </legend>
                            <div title="Quality Level" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.quality" data-update="{geofs.api.renderingQuality()}" value="3" data-min="1" data-max="6" data-precision="0">
                                <div class="slider-rail">
                                    <div class="slider-selection">
                                        <div class="slider-grippy">
                                            <input class="slider-input"/>
                                        </div>
                                    </div>
                                </div>
                                <label>Quality Level</label>
                            </div>
                        </fieldset>
                        <fieldset class="geofs-advancedGraphics geofs-advanced">
                            <span class="geofs-advancedToggle">
                    Advanced
                </span>
                            <div class="geofs-stopMousePropagation">
                                <div title="Resolution" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.advanced.resolutionScale" data-update="{geofs.api.advancedRenderingQuality()}" value="0" data-min="0.3" data-max="1.0" data-precision="1">
                                    <div class="slider-rail">
                                        <div class="slider-selection">
                                            <div class="slider-grippy">
                                                <input class="slider-input"/>
                                            </div>
                                        </div>
                                    </div>
                                    <label>Resolution</label>
                                </div>
                                <div title="Viewing Distance" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.advanced.viewingDistance" data-update="{geofs.api.advancedRenderingQuality()}" value="0" data-min="1" data-max="7" data-precision="0">
                                    <div class="slider-rail">
                                        <div class="slider-selection">
                                            <div class="slider-grippy">
                                                <input class="slider-input"/>
                                            </div>
                                        </div>
                                    </div>
                                    <label>Viewing Distance</label>
                                </div>
                                <div title="Tiles Cache Size" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.advanced.tileCacheSize" data-update="{geofs.api.advancedRenderingQuality()}" value="0" data-min="0" data-max="5000" data-precision="0">
                                    <div class="slider-rail">
                                        <div class="slider-selection">
                                            <div class="slider-grippy">
                                                <input class="slider-input"/>
                                            </div>
                                        </div>
                                    </div>
                                    <label>Tiles Cache Size</label>
                                </div>
                                <div title="Shadow Quality" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.advanced.shadowQuality" data-update="{geofs.api.advancedRenderingQuality()}" value="0" data-min="1" data-max="4" data-precision="0">
                                    <div class="slider-rail">
                                        <div class="slider-selection">
                                            <div class="slider-grippy">
                                                <input class="slider-input"/>
                                            </div>
                                        </div>
                                    </div>
                                    <label>Shadow Quality</label>
                                </div>
                                <div title="Clouds Density" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.advanced.cloudDensity" data-update="{geofs.api.advancedRenderingQuality()}" value="0" data-min="0" data-max="1" data-precision="1">
                                    <div class="slider-rail">
                                        <div class="slider-selection">
                                            <div class="slider-grippy">
                                                <input class="slider-input"/>
                                            </div>
                                        </div>
                                    </div>
                                    <label>Billboard Clouds Density</label>
                                </div>
                                <div title="Atmosphere Scattering and Volumetric Clouds Quality" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.advanced.scatteringQuality" data-update="{geofs.api.advancedRenderingQuality()}" value="1" data-min="1" data-max="7" data-precision="0">
                                    <div class="slider-rail">
                                        <div class="slider-selection">
                                            <div class="slider-grippy">
                                                <input class="slider-input"/>
                                            </div>
                                        </div>
                                    </div>
                                    <label>Atmo. & Vol. Clouds Quality</label>
                                </div>
                                <div title="Multisample anti-aliasing" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.advanced.msaaSamples" data-update="{geofs.api.advancedRenderingQuality()}" value="1" data-min="1" data-max="8" data-precision="0">
                                    <div class="slider-rail">
                                        <div class="slider-selection">
                                            <div class="slider-grippy">
                                                <input class="slider-input"/>
                                            </div>
                                        </div>
                                    </div>
                                    <label>Multisample anti-aliasing (MSAA)</label>
                                </div>
                                <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="fxaa" title="Fast approximate anti-aliasing">
                                    <input type="checkbox" id="fxaa" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.advanced.fxaa" data-update="{geofs.api.advancedRenderingQuality()}"/>
                                    <span class="mdl-switch__label">Fast approximate anti-aliasing (FXAA)</span>
                                </label>
                                <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="dropShadow" title="Drop Shadows">
                                    <input type="checkbox" id="dropShadow" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.advanced.dropShadow" data-update="{geofs.api.advancedRenderingQuality()}"/>
                                    <span class="mdl-switch__label">Drop shadows</span>
                                </label>
                                <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="softShadows" title="Soft Shadows">
                                    <input type="checkbox" id="softShadows" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.advanced.softShadows" data-update="{geofs.api.advancedRenderingQuality()}"/>
                                    <span class="mdl-switch__label">Soft shadows</span>
                                </label>
                                <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="globeLighting" title="Globle Lighting">
                                    <input type="checkbox" id="globeLighting" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.advanced.globeLighting" data-update="{geofs.api.advancedRenderingQuality()}"/>
                                    <span class="mdl-switch__label">Globe Lighting</span>
                                </label>
                            </div>
                        </fieldset>
                        <fieldset class="geofs-datasourceSelector">
                            <legend>
                    Imagery data source
                </legend>
                            <div class="geofs-SDImagerySelector">
                                <label class="mdl-radio mdl-js-radio mdl-js-ripple-effect" for="sdImagery" style="margin: 10px 0px;">
                                    <img data-deferredsrc="/images/sd-logo.png" class="geofs-dataSourceLogo"/>
                                    <input type="radio" id="sdImagery" class="mdl-radio__button" name="dataprovider" data-update="{geofs.api.setDataProvider(value)}" data-gespref="geofs.preferences.graphics.dataProvider" data-matchvalue="sd">
                                    <span class="mdl-radio__label">Sentinel-2 Satellite Images (10m/px)</span>
                                </label>
                            </div>
                            <div class="geofs-SRImagerySelector" style="position: relative;">
                                <label class="mdl-radio mdl-js-radio mdl-js-ripple-effect" for="srImagery" style="margin: 10px 0px;">
                                    <img data-deferredsrc="/images/sr-logo.png" class="geofs-dataSourceLogo"/>
                                    <input type="radio" id="srImagery" class="mdl-radio__button" name="dataprovider" data-update="{geofs.api.setDataProvider(value)}" data-gespref="geofs.preferences.graphics.dataProvider" data-matchvalue="sr">
                                    <span class="mdl-radio__label">Super-Resolution - AI Enhanced Satellite Images (1m/px)</span>
                                </label>
                                <div class="geofs-onlyForSR" style="position: absolute;border-radius: 20px;padding: 2px 35px 2px 10px;background: #fafafa;box-shadow: 1px 2px 6px #555;right:-5px;bottom:-11px;">
                                    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="runways" style="margin-bottom: 0px; margin-top: 0px;" title="Overlay Generic Runway Graphics to SR imagery">
                                        <input type="checkbox" id="runways" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.runways" data-update="{geofs.runways.setRunwayModelVisibility(this.checked)}">
                                        <span class="mdl-switch__label">Show Runway Overlays</span>
                                    </label>
                                </div>
                            </div>
                            <div class="geofs-HDImagerySelector">
                                <label class="mdl-radio mdl-js-radio mdl-js-ripple-effect" for="hdImagery" style="margin: 10px 0px;">
                                    <img data-deferredsrc="/images/hd-logo.png" class="geofs-dataSourceLogo"/>
                                    <input type="radio" id="hdImagery" class="mdl-radio__button" name="dataprovider" data-update="{geofs.api.setDataProvider(value)}" data-gespref="geofs.preferences.graphics.dataProvider" data-matchvalue="hd">
                                    <span class="mdl-radio__label">High Definition Microsoft Bing</span>
                                </label>
                                <a class="mdl-button mdl-js-button mdl-button--raised mdl-button--accent mdl-js-ripple-effect geofs-onlyForNonHDSubscribers geofs-subscribe-button geofs-onlyForApp" style="position: absolute; right: 20px;">Subscribe
</ button><a class="mdl-button mdl-js-button mdl-button--raised mdl-button--accent mdl-js-ripple-effect geofs-onlyForNonHDSubscribers geofs-hideForApp" style="position: absolute; right: 20px;" href="/pages/hd.php" target="_blank">Subscribe</a>
</ div>
<div class="geofs-HDStarImagerySelector">
    <label class="mdl-radio mdl-js-radio mdl-js-ripple-effect" for="hdStarImagery" style="margin: 10px 0px;">
        <img data-deferredsrc="/images/hdstar-logo.png" class="geofs-dataSourceLogo"/>
        <input type="radio" id="hdStarImagery" class="mdl-radio__button" name="dataprovider" data-update="{geofs.api.setDataProvider(value)}" data-gespref="geofs.preferences.graphics.dataProvider" data-matchvalue="hdstar">
        <span class="mdl-radio__label">High Definition ESRI</span>
    </label>
    <a class="mdl-button mdl-js-button mdl-button--raised mdl-button--accent mdl-js-ripple-effect geofs-onlyForNonHDSubscribers geofs-hideForApp" style="position: absolute; right: 20px;" href="/pages/hd.php" target="_blank">Subscribe</a>
</div>
<a href="/pages/hd.php" target="_blank">Bing imagery retiring November 2027 - read more</a>
<div class="geofs-hdTrial-view geofs-hideForApp" style="position: relative;">
    <script>

        function initSubscribe() {

            if (window.subscribeInitialized) {
                return;
            }

            $(document).on('loginchange subscriptionchange', (event) => {
                $('.geofs-subscribe-view').htmlView('load', '/html/hd/subscribe.php');
            }
            );

            $(document).on('click', '.geofs-startTrial', (event) => {
                $('.geofs-subscribe-view').htmlView('load', '/html/hd/subscribe.php?method=startHDTrial');
            }
            );

            window.subscribeInitialized = true;

        }

        window.executeOnEventDone('deferredload', initSubscribe);
    </script>
    <style>
        .geofs-ingame .geofs-geofsHDConfirm, .geofs-ingame .geofs-purchase-frame, .geofs-ingame .geofs-renewNotice {
            display: none;
        }

        .geofs-purchase-item {
            display: block;
            margin: 15px 0px;
        }

        .geofs-purchase-item .paddle_button {
            float: right;
        }
    </style>
    <div class="geofs-subscribe-view geofs-payment-view">
        <div class="geofs-geofsHDConfirm">
            <div class="geofs-notification geofs-info">Your HD trial period has expired</div>
        </div>
        <div class="geofs-purchase-frame mdl-shadow--2dp geofs-hideForSchool">
            <h5>Purchase a GeoFS HD subscription</h5>
            <b class="geofs-purchase-item">
                <a href="#" class="paddle_button" data-theme="light" data-custom-data='{"user_id": "639896"}' data-items='[{"priceId": "pri_01j6y3wbpcgffcdcz2phbtgbww", "quantity": 1}]'>Buy with Paddle.com</a>
                1 year GeoFS HD global aerial imagery: <span class="geofs-HD-price"></span>
            </b>
            <b class="geofs-purchase-item">
                <a href="#" class="paddle_button" data-theme="light" data-custom-data='{"user_id": "639896"}' data-items='[{"priceId": "pri_01m2tfeashh6e5brfm3nhe1mmw", "quantity": 1}]'>Buy with Paddle.com</a>
                1 Month GeoFS HD global aerial imagery: <span class="geofs-HDMonth-price"></span>
            </b>
        </div>
        <h6 class="geofs-renewNotice" style="text-align: center;">
            <i>
                Subscription and trial do <b>not</b>
                renew automatically.<br/>You can purchase a new subscription after expiration.
            </i>
        </h6>
    </div>
</div>
</ fieldset>
<fieldset>
    <legend>
                    Color enhancement
                </legend>
    <div title="Imagery Color Enhancement" class="slider" data-type="slider" data-gespref="geofs.preferences.graphics.enhanceColors" data-update="{geofs.api.enhanceColors(value)}" value="0" data-min="0.5" data-max="1.5" data-precision="1">
        <div class="slider-rail">
            <div class="slider-selection">
                <div class="slider-grippy">
                    <input class="slider-input"/>
                </div>
            </div>
        </div>
        <label>Enhancement Level</label>
    </div>
    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="advancedAtmosphere" title="Advanced Atmosphere">
        <input type="checkbox" id="advancedAtmosphere" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.advancedAtmosphere" data-update="{geofs.api.renderingQuality()}">
        <span class="mdl-switch__label">Advanced Atmosphere</span>
    </label>
    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="volumetricClouds" title="Volumetric clouds">
        <input type="checkbox" id="volumetricClouds" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.volumetricClouds" data-update="{geofs.api.renderingQuality()}">
        <span class="mdl-switch__label">Volumetric clouds</span>
    </label>
    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="buildings" title="Enable Buildings">
        <input type="checkbox" id="buildings" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.buildings" data-update="{geofs.api.setBuildings(this.checked)}">
        <span class="mdl-switch__label">Buildings</span>
    </label>
    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="vegetation" title="Enable Vegetation">
        <input type="checkbox" id="vegetation" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.vegetation" data-update="{geofs.api.setVegetation(this.checked)}">
        <span class="mdl-switch__label">Vegetation</span>
    </label>
    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="waterEffect" title="Enable water effect">
        <input type="checkbox" id="waterEffect" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.waterEffect" data-update="{geofs.api.setWaterEffect(this.checked)}">
        <span class="mdl-switch__label">Water effect</span>
    </label>
    <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect geofs-hideForApp" for="contrails" title="Enable contrails">
        <input type="checkbox" id="contrails" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.contrails"/>
        <span class="mdl-switch__label">Contrails</span>
    </label>
    <!--
                <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect geofs-onlyForSubscribers" for="hdonoff" title="Enable HD images">
                    <input type="checkbox" id="hdonoff" class="mdl-switch__input" data-gespref="geofs.preferences.graphics.HD"
                           data-update="{if (geofs.preferences.graphics.HD==this.checked) geofs.api.setHD(this.checked)}">
                    <span class="mdl-switch__label">Enable HD</span>
                </label>
-->
</fieldset>
</ div></ li>
<li class="geofs-list-collapsible-item">
    Environment

        
    <div class="geofs-collapsible">
        <!-- Weather -->
        <fieldset>
            <label class="mdl-switch mdl-js-switch mdl-js-ripple-effect" for="weatherManual" title="Set environment manually">
                <input type="checkbox" id="weatherManual" class="mdl-switch__input" data-gespref="geofs.preferences.weather.manual" data-update="{weather.refresh();geofs.api.renderingQuality()}">
                <span class="mdl-switch__label">Set environment manually</span>
            </label>
        </fieldset>
        <fieldset>
            <legend>METAR</legend>
            <div class="geofs-metarDisplay"></div>
        </fieldset>
        <fieldset class="geofs-manualWeather">
            <legend>
                    Time of the day
                </legend>
            <div title="Set time of day" class="slider geofs-timeSlider" data-type="slider" data-gespref="geofs.preferences.weather.localTime" data-update="{weather.setDateAndTime()}" value="" data-min="0" data-max="24" data-precision="2">
                <div class="slider-rail">
                    <div class="slider-selection">
                        <div class="slider-grippy">
                            <span class="slider-input-overlay"></span>
                            <input class="slider-input"/>
                        </div>
                    </div>
                </div>
                <label>Time of the day in hours</label>
            </div>
        </fieldset>
        <fieldset class="geofs-manualWeather">
            <legend>
                    Weather
                </legend>
            <div title="Weather quality" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.quality" data-update="{weather.setManual()}" value="0" data-min="0" data-max="100" data-precision="0">
                <div class="slider-rail">
                    <div class="slider-selection">
                        <div class="slider-grippy">
                            <input class="slider-input"/>
                        </div>
                    </div>
                </div>
                <label>Weather quality</label>
            </div>
            <div title="Season" class="slider geofs-seasonSlider" data-type="slider" data-gespref="geofs.preferences.weather.season" data-update="{weather.setManual()}" value="" data-min="0" data-max="100" data-precision="0">
                <div class="slider-rail">
                    <div class="slider-selection">
                        <div class="slider-grippy">
                            <span class="slider-input-overlay"></span>
                            <input class="slider-input"/>
                        </div>
                    </div>
                </div>
                <label>Season</label>
            </div>
        </fieldset>
        <fieldset class="geofs-manualWeather geofs-advancedWeather geofs-advanced">
            <span class="geofs-advancedToggle">
                    Advanced
                </span>
            <div class="geofs-stopMousePropagation">
                <div title="Clouds" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.clouds" data-update="{weather.setAdvanced()}" value="0" data-min="0" data-max="100" data-precision="0">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Clouds</label>
                </div>
                <div title="CloudsCeiling" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.cloudBase" data-update="{weather.setAdvanced()}" value="1500" data-min="1" data-max="5000" data-precision="0">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Clouds Ceiling m.</label>
                </div>
                <div title="CloudsThickness" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.cloudThickness" data-update="{weather.setAdvanced()}" value="4000" data-min="500" data-max="10000" data-precision="0">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Clouds Thickness m.</label>
                </div>
                <div title="Precipitations" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.precipitationAmount" data-update="{weather.setAdvanced()}" value="0" data-min="0" data-max="100" data-precision="0">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Precipitations</label>
                </div>
                <div title="Fog" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.fog" data-update="{weather.setAdvanced()}" value="0" data-min="0" data-max="100" data-precision="0">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Fog</label>
                </div>
                <div title="FogCeiling" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.fogCeiling" data-update="{weather.setAdvanced()}" value="0" data-min="0" data-max="3000" data-precision="0">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Fog Ceiling m.</label>
                </div>
                <div title="windSpeed" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.windSpeedKts" data-update="{weather.setAdvanced()}" value="0" data-min="0" data-max="40" data-precision="0">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Wind Speed knots</label>
                </div>
                <div title="windDirection" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.windDirection" data-update="{weather.setAdvanced()}" value="0" data-min="0" data-max="360" data-precision="0">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Wind Direction Deg.</label>
                </div>
                <div title="turbulences" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.turbulences" data-update="{weather.setAdvanced()}" value="0" data-min="0" data-max="1" data-precision="1">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Turbulences.</label>
                </div>
                <div title="thermals" class="slider" data-type="slider" data-gespref="geofs.preferences.weather.advanced.thermals" data-update="{weather.setAdvanced()}" value="0" data-min="0" data-max="1" data-precision="1">
                    <div class="slider-rail">
                        <div class="slider-selection">
                            <div class="slider-grippy">
                                <input class="slider-input"/>
                            </div>
                        </div>
                    </div>
                    <label>Thermals.</label>
                </div>
            </div>
        </fieldset>
    </div>
</li>
<!--
    <li class="geofs-list-collapsible-item geofs-onlyForMobile">Reset settings
        <div class="geofs-collapsible geofs-tab-debug">
            In case of recurring error, please try to reset saved settings to default:<br/>
            <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" onclick="geofs.resetPreferences(/*refreshPanel*/ true);">Reset Settings</button>
        </div>
    </li>
-->
<li class="geofs-list-collapsible-item">
    Debug info
        
    <div class="geofs-collapsible geofs-tab-debug">
        <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" onclick="geofs.resetPreferences(/*refreshPanel*/ true);">Reset Settings & Preferences</button>
        <br/>
        <br/>
        <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--accent" onclick="window.location.reload(true);">Reload with GEOFS clean cache</button>
        <br/>
        <br/>
        GeoFS version: 3.9<br/>
        <br/>
        <div class="geofs-debug-info"></div>
    </div>
</li>
<button class="mdl-button mdl-js-button mdl-button--fab mdl-button--accent mdl-js-ripple-effect geofs-close-panel geofs-onlyForMobile" onclick="geofs.savePreferencesPanel(); ui.closePreferencePanel();">
    <i class="material-icons">close</i>
</button>
<!-- Bottom buttons -->
<div class="geofs-preferenceForm geofs-hideForMobile">
    <div style="float: left;">
        <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" onclick="geofs.resetPreferences(/*refreshPanel*/ true);">Reset Settings</button>
    </div>
    <div style="float: right;">
        <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--accent" onclick="geofs.savePreferencesPanel(); ui.closePreferencePanel();">Save & Close</button>
    </div>
</div>
</ ul>
<ul class="geofs-list geofs-toggle-panel geofs-location-list">
    <li class="geofs-list-collapsible-item">
        Gliding/Wingsuit
        
        <ul class="geofs-collapsible">
            <li data-location="geofs.flyTo([49.52150,22.41008,0,-166, true]);">Gravity launch - Bezmiechowa, Poland</li>
            <li data-location="geofs.flyTo([32.88577,-117.25325,164,-12, true]);">Slope soaring - Torrey Pines - San Diego - USA</li>
            <li data-location="geofs.flyTo([54.21837,-1.22314,763,26, true]);">Yorkshire Gliding Club - North Yorkshire - UK</li>
            <li data-location="geofs.flyTo([45.21552,5.74775,1598,42, true]);">Ridge Soaring - Le Versoud - Grenoble - France</li>
            <li data-location="geofs.flyTo([8.01869,46.36961,2971,61, true]);">Alpine Glaciers - toward Münster - Switzerland</li>
            <li data-location="geofs.flyTo([45.81749,6.84854,6467,55, true]);">Wingsuit drop - Mont Blanc - France</li>
            <li data-location="geofs.flyTo([47.1560,9.30583,2882,-155, true]);">Wingsuit drop - "The Crack" - Walenstadt - Switzerland</li>
            <li data-location="geofs.flyTo([37.74321,-119.53340,2725,-49, true]);">Wingsuit drop - "Half Dome" - Yosemite National Park, USA</li>
        </ul>
    </li>
    <li class="geofs-list-collapsible-item">
        Canyons
        
        <ul class="geofs-collapsible">
            <li data-location="geofs.flyTo([36.38005,-117.46087,725,-108, true]);">Rainbow "Star Wars" Canyon - USA</li>
            <li data-location="geofs.flyTo([39.70598,-121.47025,1171,2, true]);">Feather River "Top Gun" Canyon - USA</li>
            <li data-location="geofs.flyTo([52.72760,-3.82962,340,-159, true]);">Mach Loop - Wales - UK</li>
            <li data-location="geofs.flyTo([43.89442,3.43265,660,71, true]);">Gorges de la Vis - France</li>
            <li data-location="geofs.flyTo([29.74833,95.09795,5356,-80, true]);">Yarlung Tsangpo Grand Canyon - Tibet</li>
            <li data-location="geofs.flyTo([-24.55816,30.70011,2301,52, true]);">Blyde River Canyon - South Africa</li>
            <li data-location="geofs.flyTo([36.06467,-113.33665,2858,168,true]);">Grand Canyon - USA</li>
        </ul>
    </li>
    <li class="geofs-list-collapsible-item">
        Special Approaches
        
        <ul class="geofs-collapsible">
            <li data-location="geofs.flyTo([51.50137,0.17804,786,-87, true]);">London City Airport (Runway 27 with steep 5.5° ILS slope)</li>
            <li data-location="geofs.flyTo([36.145,-5.551,800,90, true]);">Gibraltar Int'l</li>
            <li data-location="geofs.flyTo([37.807416414832694,-122.6137032378986,309,173.32, true]);">USS John C. Stennis (Carrier)</li>
            <li data-location="geofs.flyTo([24.55734481134812,-81.71068081353695,500,-91.41, true]);">Key West Int'l.</li>
            <li data-location="geofs.flyTo([18.034682701324222,-63.15433542979288,350,82, true]);">Princess Juliana Airport, Saint Maarten</li>
            <li data-location="geofs.flyTo([32.73121515773958,-16.735523534674982,317,-134, true]);">Santa Catarina Airport (Funchal), Madeira</li>
            <li data-location="geofs.flyTo([43.71957166711304,7.303216893528995,450,-135.72, true]);">Aéroport Nice Côte d'Azur</li>
            <li data-location="geofs.flyTo([-44.76861,167.75399,558,178, true]);">Quintin Lodge Airstrip - New Zealand</li>
            <li data-location="geofs.flyTo([45.43225365746484,6.683131212012103,2500,-134, true]);">Courchevel Altiport</li>
            <li data-location="geofs.flyTo([45.86370,6.622133,1600,155, true]);">Megève Altiport</li>
            <li data-location="geofs.flyTo([45.44933,6.54963,2000,156, true]);">Méribel Altiport</li>
            <li data-location="geofs.flyTo([27.660295165543864,86.7058402035465,3255,31, true]);">Lukla - Nepal (approach)</li>
            <li data-location="geofs.flyTo([17.6543948750155,-63.24368391186655,154,115, true]);">Juancho E. Yrausquin - Saba (approach)</li>
            <li data-location="geofs.flyTo([43.578924,-6.09867,550,104, true]);">Asturias - Spain (approach)</li>
            <li data-location="geofs.flyTo([30.578892650446615,2.814844431592091,800,102.44, true]);">El Golea - Algeria (approach)</li>
            <li data-location="geofs.flyTo([17.9039979948387,-62.85894189052203,162,87, true]);">Saint Barthélemy (approach)</li>
            <li data-location="geofs.flyTo([56.998322183007005,-7.410804568469447,376,-47, true]);">Barra Airport - Scotland (beach landing)</li>
        </ul>
    </li>
    <li class="geofs-list-collapsible-item">
        On Runway
        
        <ul class="geofs-collapsible">
            <li data-location="geofs.flyTo([-22.81244,-43.26368,0,126]);">Rio Galeão – Tom Jobim International Airport (Brazil) - 15</li>
            <li data-location="geofs.flyTo([48.99873,2.60975,0,-95]);">Charles de Gaulle International Airport - 26R</li>
            <li data-location="geofs.flyTo([51.15143,-0.16629,0,-102]);">London Gatwick Airport - 26L</li>
            <li data-location="geofs.flyTo([37.62616,-122.39275,0,118]);">San Francisco International Airport - 10R</li>
            <li data-location="geofs.flyTo([40.45589,-3.54654,0,-39]);">Madrid–Barajas Airport - 32L</li>
            <li data-location="geofs.flyTo([52.29109,4.77737,0,2]);">Amsterdam Airport Schiphol - 36R</li>
            <li data-location="geofs.flyTo([43.66555302435758,7.228367855065596,0,-135]);">Aéroport Nice Côte d'Azur - 22L</li>
            <li data-location="geofs.flyTo([42.36021520436057,-70.98767662157663,0,-103.54]);">Logan Int'l (Boston) - 27</li>
            <li data-location="geofs.flyTo([25.800717256450998,-80.30116643603567,0,87.65]);">Miami Int'l - 08R</li>
            <li data-location="geofs.flyTo([39.66435,-119.89166,0,95]);">Reno Stead Airport 08 - (Reno Air Races) - USA</li>
            <li data-location="geofs.flyTo([33.93726741762918,-118.38364975124578,0,-96.50347129433592]);">Los Angeles Int'l, USA - 25L</li>
            <li data-location="geofs.flyTo([43.67416610318312,10.384369181910223,0,36.54]);">Pisa - Italy - 04R</li>
            <li data-location="geofs.flyTo([46.970496925890174,8.385052215851225,0,64]);">Buochs - Switzerland -  07L</li>
            <li data-location="geofs.flyTo([53.33191343454627,-2.3107668633750715,0,51.43]);">Manchester Int'l - UK - 05</li>
            <li data-location="geofs.flyTo([25.247580920322463,55.381149447648966,0,-58.28]);">Dubai Int'l - UAE - 30L</li>
            <li data-location="geofs.flyTo([35.67747,-117.68053,0,-26]);">Naval Air Weapons Station China Lake - USA - 32</li>
            <li data-location="geofs.flyTo([37.77915,-122.60885,0,176]);">USS John C. Stennis (Carrier)</li>
            <li data-location="geofs.flyTo([-29.930402181454788,27.84595492343562,0,56]);">Matekane Air Strip – Lesotho</li>
            <li data-location="geofs.flyTo([25.14114,55.18553,0,48]);">Burj Al Arab Helipad - Dubai</li>
            <li data-location="geofs.flyTo([35.53978,139.80508,0,-30]);">Tokyo Haneda International Airport - Japan - 34R</li>
            <li data-location="geofs.flyTo([28.54719,77.06549,0,104]);">Indira Gandhi International Airport - Palam, Delhi - India - 11</li>
            <li data-location="geofs.flyTo([49.99850,8.52628,0,-0]);">Frankfurt am Main Airport - Germany - 36</li>
            <li data-location="geofs.flyTo([22.65284,113.80315,0,153]);">Shenzhen Bao'an International Airport - China - 15</li>
        </ul>
    </li>
    <li class="geofs-list-collapsible-item">
        Landmarks
        
        <ul class="geofs-collapsible">
            <li data-location="geofs.flyTo([-22.95814,-43.21994,687,67,true]);">Christ the Redeemer - Rio de Janeiro - Brazil</li>
            <li data-location="geofs.flyTo([48.86406,2.35407,588,-89,true]);">Eiffel Tower - Paris - France</li>
            <li data-location="geofs.flyTo([29.99106,31.16787,296,-122,true]);">Giza Pyramids - Cairo - Egypt</li>
            <li data-location="geofs.flyTo([37.82456,-122.52355,586,98,true]);">Golden Gate Bridge - San Francisco - USA</li>
            <li data-location="geofs.flyTo([-33.85425,151.22325,100,-100,true]);">Sydney Opera House - Australia</li>
            <li data-location="geofs.flyTo([40.67714,-74.04980,351,31,true]);">Statue of Liberty - New York City - USA</li>
            <li data-location="geofs.flyTo([37.96932,23.70606,290,95,true]);">Acropolis - Athens - Greece</li>
            <li data-location="geofs.flyTo([47.60582,10.71615,1077,153,true]);">Neuschwanstein Castle - Germany</li>
            <li data-location="geofs.flyTo([51.48472,-0.13910,561,37,true]);">Westminster - London - UK</li>
            <li data-location="geofs.flyTo([31.30692,32.30096,1041,176,true]);">Suez Canal - Egypt</li>
        </ul>
    </li>
    <li class="geofs-list-collapsible-item geofs-list-item-expanded">
        Nature and Landscapes
        
        <ul class="geofs-collapsible">
            <li data-location="geofs.flyTo([45.98150,6.92170,2966,-154,true]);">Chamonix - Alps - France</li>
            <li data-location="geofs.flyTo([55.93793,-4.92143,302,350,,true]);">West Coast of Scotland</li>
            <li data-location="geofs.flyTo([28.06110,86.97510,10000,-151,true]);">Mount Everest - Nepal</li>
            <li data-location="geofs.flyTo([43.76783,11.37363,863,-95,true]);">Florence - Tuscany - Italy</li>
            <li data-location="geofs.flyTo([31.10148,-7.59875,3661,-135,true]);">Atlas Mountains - Morocco</li>
            <li data-location="geofs.flyTo([-14.84324,-75.00751,2724,-52,true]);">Nazca - Peru</li>
            <li data-location="geofs.flyTo([24.73165,110.50282,1000,-70,true]);">Li Jiang Li river - China</li>
            <li data-location="geofs.flyTo([-25.37599,131.08359,717,-57,true]);">Uluru - Australia</li>
            <li data-location="geofs.flyTo([-14.52559,145.07787,2824,-41,true]);">Great Barrier Reef - Australia</li>
            <li data-location="geofs.flyTo([51.27062,-115.20700,2766,-114,true]);">Banff National Park - Canada</li>
            <li data-location="geofs.flyTo([-16.59100,-151.67659,1260,-39,true]);">Bora Bora - French Polynesia</li>
            <li data-location="geofs.flyTo([-34.00027,18.31149,1662,42,true]);">Cape Town - South Africa</li>
            <li data-location="geofs.flyTo([-24.75169,15.41842,1526,30,true]);">Namib Desert, Namib-Naukluft National Park - Namibia</li>
            <li data-location="geofs.flyTo([68.12074,13.27249,879,-146,true]);">Lofoten Islands - Norway</li>
            <li data-location="geofs.flyTo([63.01118,-41.96222,2453,-97,true]);">Glaciers - Tingmiarmit - Greenland</li>
            <li data-location="geofs.flyTo([57.88290,-6.74588,2124,-96,true]);">Isle of Skye - Scotland</li>
            <li data-location="geofs.flyTo([-34.19204,-69.57684,4458,-79,true]);">Laguna del Diamante - Argentina</li>
            <li data-location="geofs.flyTo([44.13973,9.66095,500,125,true]);">Cinque Terre - Italia</li>
            <li data-location="geofs.flyTo([28.95784,-13.78437,1429,53,true]);">Lanzarote - Canary Islands - Spain</li>
            <li data-location="geofs.flyTo([37.45566,15.10363,2501,-22,true]);">Mount Etna - Sicily - Italy</li>
            <li data-location="geofs.flyTo([35.05725,-111.06175,2971,128,true]);">Meteor Crater - Arizona - U.S.A.</li>
            <li data-location="geofs.flyTo([40.42196,116.59606,1327,-56,true]);">Great Wall of China - China</li>
            <li data-location="geofs.flyTo([35.31841,138.99077,1832,-86,true]);">Mount Fuji - Japan</li>
            <li data-location="geofs.flyTo([-20.98191,-174.98761,1285,-163,true]);">Tongatapu - Tonga</li>
            <li data-location="geofs.flyTo([-43.83974,170.11602,1162,2,true]);">Aoraki / Mount Cook - New Zealand</li>
            <li data-location="geofs.flyTo([-39.18926,174.01516,2136,149,true]);">Mount Taranaki - New Zealand</li>
            <li data-location="geofs.flyTo([-39.07978,175.66809,3121,-169,true]);">Mount Ngauruhoe - New Zealand</li>
            <li data-location="geofs.flyTo([-3.34227,37.20525,1225,24,true]);">Mount Kilimanjaro - Tanzania</li>
        </ul>
    </li>
    <form class="geofs-locationForm geofs-stopMousePropagation geofs-stopKeyupPropagation">
        <div class="mdl-textfield mdl-js-textfield" style="width: 100%; padding-right: 86px;">
            <input class="mdl-textfield__input address-input" type="text" id="address" placeholder="Type destination, ICAO, etc.">
            <label class="mdl-textfield__label" for="address">Type destination...</label>
        </div>
        <button class="mdl-button mdl-js-button mdl-button--raised mdl-button--colored" type="submit" style="margin-left: -65px;">Go</button>
    </form>
</ul>
<script>

    window.geofs = window.geofs || {};
    geofs.aircraftList = {};

    geofs.aircraftList['1'] = {
        name: 'Piper Cub',
        dir: '|models|aircraft|premium|cub|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['2'] = {
        name: 'Cessna 172',
        dir: '|models|aircraft|premium|cessna_172|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['3'] = {
        name: 'Alphajet PAF',
        dir: '|models|aircraft|premium|alphajet_paf|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['4'] = {
        name: 'Boeing 737-700',
        dir: '|models|aircraft|premium|737_700|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['5'] = {
        name: 'Embraer Phenom 100',
        dir: '|models|aircraft|premium|phenom_100|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['6'] = {
        name: 'de Havilland DHC6 Twin Otter',
        dir: '|models|aircraft|premium|dhc6|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['7'] = {
        name: ' F-16 Fighting Falcon',
        dir: '|models|aircraft|premium|f16|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['8'] = {
        name: 'Pitts Special S1',
        dir: '|models|aircraft|premium|pitts|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['9'] = {
        name: 'Eurocopter EC135',
        dir: '|models|aircraft|premium|ec135|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['10'] = {
        name: 'Airbus A380',
        dir: '|models|aircraft|premium|a380|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['11'] = {
        name: 'Alisport Silent 2 Electro',
        dir: '|models|aircraft|premium|silent2|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['12'] = {
        name: 'Pilatus PC-7 Mk-I',
        dir: '|models|aircraft|premium|pc7|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['13'] = {
        name: 'de Havilland Canada DHC-2 Beaver',
        dir: '|models|aircraft|premium|dhc2|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['14'] = {
        name: 'Colomban MC-15 Cri-cri',
        dir: '|models|aircraft|premium|cricri|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['15'] = {
        name: 'Lockheed P-38 Lightning F-5B',
        dir: '|models|aircraft|premium|p38|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['16'] = {
        name: 'Douglas DC-3',
        dir: '|models|aircraft|premium|dc3|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['17'] = {
        name: 'McDonnell Douglas DC-10-40',
        dir: '|models|aircraft|premium|dc10|',
        'multiplayerFiles': 'multiplayer.glb,multiplayer-low.glb',
        'community': 0
    };
    geofs.aircraftList['18'] = {
        name: 'Sukhoi Su-35',
        dir: '|models|aircraft|premium|su35|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['20'] = {
        name: 'Concorde',
        dir: '|models|aircraft|premium|concorde|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['21'] = {
        name: 'Zlin Z-50',
        dir: '|models|aircraft|zlin|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['22'] = {
        name: 'Cessna 152',
        dir: '|models|aircraft|premium|c152|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['23'] = {
        name: 'Piper PA-28 161 Warrior II Aerobility',
        dir: '|models|aircraft|premium|pa28|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['24'] = {
        name: 'Airbus A350',
        dir: '|models|aircraft|premium|a350|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['25'] = {
        name: 'Boeing 777-300ER',
        dir: '|models|aircraft|premium|777_300|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['26'] = {
        name: 'Antonov An-140',
        dir: '|models|aircraft|AN140|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['27'] = {
        name: 'Boeing F/A-18F Super Hornet',
        dir: '|models|aircraft|premium|fa18|',
        'multiplayerFiles': 'multiplayer.glb,multiplayer-low.glb',
        'community': 0
    };
    geofs.aircraftList['28'] = {
        name: 'Beechcraft Baron B55',
        dir: '|models|aircraft|premium|b55|',
        'multiplayerFiles': 'multiplayer1.glb,multiplayer-low.glb',
        'community': 0
    };
    geofs.aircraftList['29'] = {
        name: 'Dassault Rafale',
        dir: '|models|aircraft|premium|rafale|',
        'multiplayerFiles': 'multiplayer.glb,multiplayer-low.glb',
        'community': 0
    };
    geofs.aircraftList['31'] = {
        name: 'Potez 25',
        dir: '|models|aircraft|premium|potez25|',
        'multiplayerFiles': 'multiplayer.glb,multiplayer-low.glb',
        'community': 0
    };
    geofs.aircraftList['32'] = {
        name: 'Northrop T-38 Talon',
        dir: '|models|aircraft|premium|t38|',
        'multiplayerFiles': 'multiplayer.glb,multiplayer-low.glb',
        'community': 0
    };
    geofs.aircraftList['40'] = {
        name: 'Evektor Sportstar',
        dir: '|models|aircraft|sportstar|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['41'] = {
        name: 'szd-48-3 Jantar',
        dir: '|models|aircraft|jantar|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['50'] = {
        name: 'Paraglider',
        dir: '|models|aircraft|paraglider|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['51'] = {
        name: 'Major Tom (hot air balloon)',
        dir: '|models|aircraft|premium|majortom|',
        'multiplayerFiles': 'multiplayer.glb,multiplayer-low.glb',
        'community': 0
    };
    geofs.aircraftList['52'] = {
        name: 'Hughes 269a/TH-55 Osage',
        dir: '|models|aircraft|hughes|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['53'] = {
        name: 'Goat Airchair',
        dir: '|models|aircraft|goat|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['54'] = {
        name: 'Goat Airchair',
        dir: '|models|aircraft|premium|goat|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['55'] = {
        name: 'Hughes 269a/TH-55 Osage',
        dir: '|models|aircraft|premium|hughes|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['56'] = {
        name: 'Paraglider',
        dir: '|models|aircraft|premium|paraglider|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['102'] = {
        name: 'Citroen 2CV',
        dir: '|models|aircraft|premium|2cv|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['103'] = {
        name: 'Wingsuit',
        dir: '|models|aircraft|premium|wingsuit|',
        'multiplayerFiles': 'multiplayer.glb,multiplayer-low.glb',
        'community': 0
    };
    geofs.aircraftList['235'] = {
        name: 'Boeing 787-8',
        dir: '|backend|aircraft|repository|GXD01E_126645_235|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['236'] = {
        name: 'Embraer E190',
        dir: '|backend|aircraft|repository|GXD02RZ_126645_236|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['237'] = {
        name: 'Boeing 767-300ER',
        dir: '|backend|aircraft|repository|GXD03FI_126645_237|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['238'] = {
        name: 'Boeing 757-200',
        dir: '|backend|aircraft|repository|GXD04N_126645_238|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['239'] = {
        name: 'Airbus A350-900',
        dir: '|backend|aircraft|repository|GXD05OQ_166617_239|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['240'] = {
        name: 'Boeing 777-300ER',
        dir: '|backend|aircraft|repository|Boeing 777-300ER_933_240|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['242'] = {
        name: 'Airbus A321neo',
        dir: '|backend|aircraft|repository|D02_933_242|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['244'] = {
        name: 'Airbus A330-300',
        dir: '|backend|aircraft|repository|A02_166635_244|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['247'] = {
        name: 'Bombardier Dash 8 Q400',
        dir: '|backend|aircraft|repository|E01_166635_247|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['252'] = {
        name: 'Boeing 747-8 Freighter',
        dir: '|backend|aircraft|repository|A03_166635_252|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['1000'] = {
        name: 'Unkown',
        dir: '|models|aircraft|generics|787|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1001'] = {
        name: 'Boeing 73x',
        dir: '|models|aircraft|generics|73x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1002'] = {
        name: 'Boeing 74x',
        dir: '|models|aircraft|generics|74x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1003'] = {
        name: 'Boeing 75x',
        dir: '|models|aircraft|generics|75x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1004'] = {
        name: 'Boeing 76x',
        dir: '|models|aircraft|generics|76x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1005'] = {
        name: 'Boeing 77x',
        dir: '|models|aircraft|generics|77x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1006'] = {
        name: 'Boeing 78x',
        dir: '|models|aircraft|generics|78x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1007'] = {
        name: 'Airbus A31x',
        dir: '|models|aircraft|generics|a31x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1008'] = {
        name: 'Airbus A32x',
        dir: '|models|aircraft|generics|a32x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1009'] = {
        name: 'Airbus A33x',
        dir: '|models|aircraft|generics|a33x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1010'] = {
        name: 'Airbus A34x',
        dir: '|models|aircraft|generics|a34x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1011'] = {
        name: 'Airbus A35x',
        dir: '|models|aircraft|generics|a35x|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1012'] = {
        name: 'Airbus A380',
        dir: '|models|aircraft|generics|a380|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1013'] = {
        name: 'ATR42',
        dir: '|models|aircraft|generics|atr42|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1014'] = {
        name: 'BAE146',
        dir: '|models|aircraft|generics|bae146|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1015'] = {
        name: 'CRJ 700',
        dir: '|models|aircraft|generics|crj700|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1016'] = {
        name: 'CRJ 900',
        dir: '|models|aircraft|generics|crj900|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1017'] = {
        name: 'Embraer 170',
        dir: '|models|aircraft|generics|e170|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1018'] = {
        name: 'Embraer 190',
        dir: '|models|aircraft|generics|e190|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1019'] = {
        name: 'Piper PA-28',
        dir: '|models|aircraft|generics|pa28|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1020'] = {
        name: 'Dash 8',
        dir: '|models|aircraft|generics|dh8|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1021'] = {
        name: 'Cessna Citation',
        dir: '|models|aircraft|generics|c25a|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1022'] = {
        name: 'Cessna',
        dir: '|models|aircraft|generics|c182|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1023'] = {
        name: 'MD11',
        dir: '|models|aircraft|generics|md11|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1024'] = {
        name: 'Mirage 2000',
        dir: '|models|aircraft|generics|mirage2000|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1025'] = {
        name: 'Helicopter',
        dir: '|models|aircraft|generics|heli|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1026'] = {
        name: 'Cirrus SR22',
        dir: '|models|aircraft|generics|sr22|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1027'] = {
        name: 'Ground Vehicle',
        dir: '|models|objects|vehicles|truck|',
        'multiplayerFiles': '',
        'community': 0
    };
    geofs.aircraftList['1069'] = {
        name: 'Cirrus SR22 GTS Turbo',
        dir: '|backend|aircraft|repository|E02_166635_1069|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2000'] = {
        name: 'Retro 172',
        dir: '|models|aircraft|retro|c172|',
        'multiplayerFiles': 'multiplayer.gltf,multiplayer-low.gltf',
        'community': 0
    };
    geofs.aircraftList['2003'] = {
        name: 'Boeing 737-800',
        dir: '|backend|aircraft|repository|Boeing 737-800_187219_1003|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2004'] = {
        name: 'CRJ-900',
        dir: '|backend|aircraft|repository|CRJ-900_187219_1004|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2153'] = {
        name: 'Airbus A340-600',
        dir: '|backend|aircraft|repository|G5_166635_2153|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2310'] = {
        name: 'A-10C Thunderbolt II',
        dir: '|backend|aircraft|repository|A10 II Warthog_310810_2310|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2364'] = {
        name: 'Lockheed SR-71A Blackbird',
        dir: '|backend|aircraft|repository|B-1_241731_2364|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2386'] = {
        name: 'Boeing 787-9 Dreamliner',
        dir: '|backend|aircraft|repository|G8_166635_2386|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2395'] = {
        name: 'BAe 146-300/Avro RJ100',
        dir: '|backend|aircraft|repository|_310810_2395|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2418'] = {
        name: 'ATR 72-600 (HOP!)',
        dir: '|backend|aircraft|repository|New P-Series_267286_2418|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2420'] = {
        name: 'ATR 72-600',
        dir: '|backend|aircraft|repository|ATR 72-600 (SAS)_267286_2420|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2426'] = {
        name: 'ATR 42-600',
        dir: '|backend|aircraft|repository|ATR 72-500 (UTair)_267286_2426|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2461'] = {
        name: 'Cirrus Vision Jet/SF50 G2',
        dir: '|backend|aircraft|repository|GA-1_310810_2461|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2556'] = {
        name: 'Northrop Grumman B-2 Spirit',
        dir: '|backend|aircraft|repository|_260077_2556|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2581'] = {
        name: 'F-14B Tomcat ',
        dir: '|backend|aircraft|repository|MA-2_310810_2581|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2700'] = {
        name: 'Embraer ERJ-195AR (Breeze)',
        dir: '|backend|aircraft|repository|_228942_2700|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2706'] = {
        name: 'Bombardier CRJ 200',
        dir: '|backend|aircraft|repository|Bomabardier CRJ 200_388316_2706|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2726'] = {
        name: 'Scaled Composites 339 SpaceShipTwo',
        dir: '|backend|aircraft|repository|P140_267286_2726|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2750'] = {
        name: 'Caproni Stipa',
        dir: '|backend|aircraft|repository|Caproni Stipa_358831_2750|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2752'] = {
        name: 'Scaled Composites 348 WhiteKnightTwo',
        dir: '|backend|aircraft|repository|P141_267286_2752|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2769'] = {
        name: 'Boeing 737 Max 8 (TUI)',
        dir: '|backend|aircraft|repository|EL AL 737-900_427352_2769|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2772'] = {
        name: 'Boeing 737 Max 8 (SpiceJet)',
        dir: '|backend|aircraft|repository|SpiceJet 737-900_427352_2772|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2786'] = {
        name: 'Grumman JF2-5 Duck',
        dir: '|backend|aircraft|repository|starship_358831_2786|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2788'] = {
        name: 'Antonov An-225 Mriya',
        dir: '|backend|aircraft|repository|An-225 2.0_260077_2788|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2806'] = {
        name: 'Sikorsky S-97 Raider',
        dir: '|backend|aircraft|repository|M150V_267286_2806|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2808'] = {
        name: 'Supermarine Spitfire Mk XIV',
        dir: '|backend|aircraft|repository|HA-1_310810_2808|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2840'] = {
        name: 'Bell UH-1H Iroquois',
        dir: '|backend|aircraft|repository|UH-1D_286491_2840|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2843'] = {
        name: 'Airbus A220-300 (Air Tanzania)',
        dir: '|backend|aircraft|repository|a220-300_230250_2843|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2844'] = {
        name: 'Falcon 9',
        dir: '|backend|aircraft|repository|Falcon 9_358831_2844|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2852'] = {
        name: 'Cameron R-650 Rozière Balloon',
        dir: '|backend|aircraft|repository|A140_267286_2852|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2856'] = {
        name: 'Airbus a330-200',
        dir: '|backend|aircraft|repository|Airbus A400M Atlas_388316_2856|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2857'] = {
        name: 'F-22 Raptor',
        dir: '|backend|aircraft|repository|F22 Test_285706_2857|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2864'] = {
        name: 'AgustaWestland AW609',
        dir: '|backend|aircraft|repository|M200V_267286_2864|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2865'] = {
        name: 'Airbus a320neo(Air India)',
        dir: '|backend|aircraft|repository|airbus a320-214 (Indigo)_427352_2865|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2870'] = {
        name: 'Airbus a321-232',
        dir: '|backend|aircraft|repository|airbus a320-214 (Eurowings)_427352_2870|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2871'] = {
        name: 'Airbus a320neo (Iberia)',
        dir: '|backend|aircraft|repository|airbus a320-214 (Easyjet)_427352_2871|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2878'] = {
        name: 'Airbus A319 (Air China)',
        dir: '|backend|aircraft|repository|Saudi Airbus A319_230250_2878|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2879'] = {
        name: 'Airbus A319 (Finnair) ',
        dir: '|backend|aircraft|repository|Philpians a319_230250_2879|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2892'] = {
        name: 'SAAB 340',
        dir: '|backend|aircraft|repository|SAAB 340_427352_2892|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2899'] = {
        name: 'Airbus A220-300 (Swiss)',
        dir: '|backend|aircraft|repository|Air Baltic  A220_230250_2899|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2943'] = {
        name: 'Embraer EMB120 Brasillia ',
        dir: '|backend|aircraft|repository|AW609_230250_2943|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2948'] = {
        name: '(JAaMDG) North American XB-70 Valkyrie',
        dir: '|backend|aircraft|repository|(JAaMDG) North American XB-70 Valkyrie_321805_2948|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2951'] = {
        name: 'Airbus a340-300',
        dir: '|backend|aircraft|repository|Dassault nEUROn UCAV_388316_2951|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2953'] = {
        name: 'Space Shuttle Atlantis (OV-104)',
        dir: '|backend|aircraft|repository|P180_267286_2953|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2968'] = {
        name: 'Windward Performance Perlan II',
        dir: '|backend|aircraft|repository|A150_267286_2968|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2973'] = {
        name: 'Airbus A350-1000 XWB',
        dir: '|backend|aircraft|repository|_260077_2973|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2976'] = {
        name: 'Pilatus PC12',
        dir: '|backend|aircraft|repository|Pilatus PC12_230250_2976|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2988'] = {
        name: '(TBSG, GeoAD) North American X-15',
        dir: '|backend|aircraft|repository|(TBSG, GeoAD) North American X-15_321805_2988|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['2989'] = {
        name: 'MQ9B Reaper',
        dir: '|backend|aircraft|repository|MQ9B Reaper_388316_2989|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3011'] = {
        name: 'Airbus a320-232',
        dir: '|backend|aircraft|repository|737max_427352_3011|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3036'] = {
        name: 'Embraer E195-E2',
        dir: '|backend|aircraft|repository|Binter E195-E2_230250_3036|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3049'] = {
        name: 'Lockheed Martin P-791 (LMH-1)',
        dir: '|backend|aircraft|repository|P200_267286_3049|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3054'] = {
        name: 'Boeing 737-800 [Spice9]',
        dir: '|backend|aircraft|repository|Boeing 737Max 8 (TUI)_427352_3054|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3109'] = {
        name: 'Pilatus PC24',
        dir: '|backend|aircraft|repository|PC24_230250_3109|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3140'] = {
        name: 'Airbus A319 (United)',
        dir: '|backend|aircraft|repository|Lufthansa A319-111_230250_3140|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3179'] = {
        name: 'Boeing 787-10 Dreamliner (British Airways)',
        dir: '|backend|aircraft|repository|Boeing 787-10 Dreamliner (British Airways)_427352_3179|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3180'] = {
        name: 'Boeing 787-10 Dreamliner (Etihad)',
        dir: '|backend|aircraft|repository|Boeing 787-10 Dreamliner (Etihad)_427352_3180|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3211'] = {
        name: 'UTVA75',
        dir: '|backend|aircraft|repository|Air France A220_230250_3211|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3289'] = {
        name: 'Dornier 228-200',
        dir: '|backend|aircraft|repository|HAL-Dornier 228-100_427352_3289|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3292'] = {
        name: 'Boeing p8I Neptune',
        dir: '|backend|aircraft|repository|Boeing p8I Neptune_427352_3292|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3307'] = {
        name: 'Bombardier CRJ-700',
        dir: '|backend|aircraft|repository|CRJ-700_450602_3307|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3341'] = {
        name: 'Embraer ERJ-170',
        dir: '|backend|aircraft|repository|ERJ-170 2_450602_3341|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3436'] = {
        name: 'Dornier do228-100 (Coast Gaurd)',
        dir: '|backend|aircraft|repository|a3test_427352_3436|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3460'] = {
        name: 'Grumman E-2C Hawkeye',
        dir: '|backend|aircraft|repository|Grumman E-2 Hawkeye_286491_3460|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3534'] = {
        name: 'airbus a320-214(Easyjet)',
        dir: '|backend|aircraft|repository|airbus a320-214(Sri Lankan)_427352_3534|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3575'] = {
        name: 'Boeing 787-9(Spice9)',
        dir: '|backend|aircraft|repository|Boeing 787-10 Dreamliner (ANA)_427352_3575|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3591'] = {
        name: 'F-15C Eagle',
        dir: '|backend|aircraft|repository|F-15C_450602_3591|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['3617'] = {
        name: 'Dassault Mirage 2000-5',
        dir: '|backend|aircraft|repository|Dassault Mirage 2000-5_286491_3617|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4017'] = {
        name: 'Embraer ERJ145LR (by Spice 9) &',
        dir: '|backend|aircraft|repository|ERJ145AR_230250_4017|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4090'] = {
        name: 'Robinson R-44',
        dir: '|backend|aircraft|repository|Robinson R44_402407_4090|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4140'] = {
        name: 'Boeing 737-200',
        dir: '|backend|aircraft|repository|737-200_450602_4140|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4197'] = {
        name: 'Robinson R-22',
        dir: '|backend|aircraft|repository|Robinson R22_402407_4197|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4251'] = {
        name: 'Chance Vought F4U-1D Corsair',
        dir: '|backend|aircraft|repository|M125_267286_4251|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4341'] = {
        name: 'Spirit of St louis',
        dir: '|backend|aircraft|repository|Spirit of St louis_358831_4341|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4390'] = {
        name: 'Piper PA-28 Floatplane',
        dir: '|backend|aircraft|repository|_365507_4390|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4398'] = {
        name: 'Britten-Norman BN-2 Islander (Loganair)',
        dir: '|backend|aircraft|repository|_365507_4398|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4401'] = {
        name: 'Britten-Norman BN-2 Islander (St. Barth Commuter)',
        dir: '|backend|aircraft|repository|_365507_4401|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4402'] = {
        name: 'Boeing 777 Freighter',
        dir: '|backend|aircraft|repository|G9_166635_4402|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4409'] = {
        name: 'Zenith Stol CH701',
        dir: '|backend|aircraft|repository|_365507_4409|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4596'] = {
        name: 'Vans RV6',
        dir: '|backend|aircraft|repository|_365507_4596|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4631'] = {
        name: 'Airbus A330-900neo (Virgin Atlantic)',
        dir: '|backend|aircraft|repository|a33x backup_230250_4631|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4646'] = {
        name: 'Airbus a321neo (spice9)',
        dir: '|backend|aircraft|repository|a320 2023_427352_4646|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4743'] = {
        name: 'Boeing 757-300',
        dir: '|backend|aircraft|repository|757-300_230250_4743|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4745'] = {
        name: 'Boeing 757-300wl',
        dir: '|backend|aircraft|repository|Beoing 757-300wl_230250_4745|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4764'] = {
        name: 'Boeing 767-400',
        dir: '|backend|aircraft|repository|Boeing 767-400_230250_4764|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['4949'] = {
        name: 'Goodyear Blimp',
        dir: '|backend|aircraft|repository|_241731_4949|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5002'] = {
        name: 'Beta Alia Prototype (N250UT)',
        dir: '|backend|aircraft|repository|_365507_5002|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5038'] = {
        name: 'Lockheed L-1011-1',
        dir: '|backend|aircraft|repository|Lockheed L-1011-1_450602_5038|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5061'] = {
        name: 'Sonex-B Kit (Jabiru 3300)',
        dir: '|backend|aircraft|repository|Sonex-B Kit_945960_5061|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5073'] = {
        name: 'Bombardier Learjet 45 XR',
        dir: '|backend|aircraft|repository|Bombardier Learjet 45 XR_427352_5073|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5086'] = {
        name: 'Airbus a321-211 ',
        dir: '|backend|aircraft|repository|Airbus a321-211 _427352_5086|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5156'] = {
        name: 'Airbus a318-112 by Luca &',
        dir: '|backend|aircraft|repository|Airbus a318-112 by Luca &_427352_5156|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5193'] = {
        name: 'Boeing 747-8i',
        dir: '|backend|aircraft|repository|P170_267286_5193|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5203'] = {
        name: 'Boeing 737-600 by Luca &',
        dir: '|backend|aircraft|repository|Boeing 737-600_427352_5203|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5211'] = {
        name: 'Boeing 747SP by JAaMDG &',
        dir: '|backend|aircraft|repository|737-600 by Spice9 and _364320_5211|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5229'] = {
        name: 'F-35B Lightning II',
        dir: '|backend|aircraft|repository|M135_267286_5229|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5314'] = {
        name: 'Boeing 747-100 SCA by JAaMDG &',
        dir: '|backend|aircraft|repository|Shenyang J-8 (Jeffa)_1043239_5314|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5409'] = {
        name: 'Boeing 747-400D by JAaMDG &',
        dir: '|backend|aircraft|repository|747-8F by JAaMDG and Boa93_364320_5409|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5431'] = {
        name: 'Northrop YF-23',
        dir: '|backend|aircraft|repository|Northrop YF-23_448101_5431|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5486'] = {
        name: 'Aviat A-1B Husky',
        dir: '|backend|aircraft|repository|_365507_5486|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5499'] = {
        name: 'CubCrafters CC19 XCub',
        dir: '|backend|aircraft|repository|CubCrafters CC19 XCub_450602_5499|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5516'] = {
        name: 'Boeing 747-400 LCF by Luca &',
        dir: '|backend|aircraft|repository|P17L_267286_5516|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5527'] = {
        name: 'Boeing 747-400 by JAaMDG &',
        dir: '|backend|aircraft|repository|_364320_5527|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5551'] = {
        name: 'Comac C919-100',
        dir: '|backend|aircraft|repository|P190_267286_5551|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5566'] = {
        name: 'Embraer E175 by JAaMDG',
        dir: '|backend|aircraft|repository|E175_1230343_5566|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5847'] = {
        name: 'Airbus A319neo by Spice9 &',
        dir: '|backend|aircraft|repository|Airbus A319neo by Spice9 &_364320_5847|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5947'] = {
        name: 'Avro RJ100 (BAe 146-300)',
        dir: '|backend|aircraft|repository|BAe 146 Rework_310810_5947|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['5998'] = {
        name: 'Airbus A340-600',
        dir: '|backend|aircraft|repository|Airbus A340-600_1388057_5998|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['6006'] = {
        name: 'Airbus A340-500',
        dir: '|backend|aircraft|repository|Airbus A340-500_1388057_6006|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['6012'] = {
        name: 'Airbus A330-300 (by Jeffa &',
        dir: '|backend|aircraft|repository|Airbus A330-300_781290_6012|',
        'multiplayerFiles': '',
        'community': 1
    };
    geofs.aircraftList['6131'] = {
        name: 'Boeing 737-400 by TOMAIIM &',
        dir: '|backend|aircraft|repository|qwcj_1847518_6131|',
        'multiplayerFiles': '',
        'community': 1
    };
</script>
<ul class="geofs-list geofs-toggle-panel geofs-aircraft-list">
    <li class="geofs-list-collapsible-item geofs-notstudent-role">
        Community contributed
        <ul class="geofs-collapsible">
            <li data-aircraft="2948">(JAaMDG) North American XB-70 Valkyrie (by Johani_(NeoAD))</li>
            <li data-aircraft="2988">(TBSG, GeoAD) North American X-15 (by Johani_(NeoAD))</li>
            <li data-aircraft="2310">A-10C Thunderbolt II (by Eco())</li>
            <li data-aircraft="2864">AgustaWestland AW609 (by JAaMDG)</li>
            <li data-aircraft="2843">Airbus A220-300 (Air Tanzania) (by GT[VRA])</li>
            <li data-aircraft="2899">Airbus A220-300 (Swiss) (by GT[VRA])</li>
            <li data-aircraft="5156">Airbus a318-112 by Luca & (by Spice_9)</li>
            <li data-aircraft="2878">Airbus A319 (Air China) (by GT[VRA])</li>
            <li data-aircraft="2879">Airbus A319 (Finnair)  (by GT[VRA])</li>
            <li data-aircraft="3140">Airbus A319 (United) (by GT[VRA])</li>
            <li data-aircraft="5847">Airbus A319neo by Spice9 & (by BOA93(EAA))</li>
            <li data-aircraft="3534">airbus a320-214(Easyjet) (by Spice_9)</li>
            <li data-aircraft="3011">Airbus a320-232 (by Spice_9)</li>
            <li data-aircraft="2871">Airbus a320neo (Iberia) (by Spice_9)</li>
            <li data-aircraft="2865">Airbus a320neo(Air India) (by Spice_9)</li>
            <li data-aircraft="5086">Airbus a321-211  (by Spice_9)</li>
            <li data-aircraft="2870">Airbus a321-232 (by Spice_9)</li>
            <li data-aircraft="242">Airbus A321neo (by LRX)</li>
            <li data-aircraft="4646">Airbus a321neo (spice9) (by Spice_9)</li>
            <li data-aircraft="2856">Airbus a330-200 (by Aero281)</li>
            <li data-aircraft="244">Airbus A330-300 (by LRX)</li>
            <li data-aircraft="6012">Airbus A330-300 (by Jeffa & (by randompersonintheworld)</li>
            <li data-aircraft="4631">Airbus A330-900neo (Virgin Atlantic) (by GT[VRA])</li>
            <li data-aircraft="2951">Airbus a340-300 (by Aero281)</li>
            <li data-aircraft="6006">Airbus A340-500 (by SAMU12pp)</li>
            <li data-aircraft="2153">Airbus A340-600 (by LRX)</li>
            <li data-aircraft="5998">Airbus A340-600 (by SAMU12pp)</li>
            <li data-aircraft="2973">Airbus A350-1000 XWB (by NS-Studios)</li>
            <li data-aircraft="239">Airbus A350-900 (by GX Development)</li>
            <li data-aircraft="2788">Antonov An-225 Mriya (by NS-Studios)</li>
            <li data-aircraft="2426">ATR 42-600 (by JAaMDG)</li>
            <li data-aircraft="2420">ATR 72-600 (by JAaMDG)</li>
            <li data-aircraft="2418">ATR 72-600 (HOP!) (by JAaMDG)</li>
            <li data-aircraft="5486">Aviat A-1B Husky (by coolpilot11)</li>
            <li data-aircraft="2395">BAe 146-300/Avro RJ100 (by Eco())</li>
            <li data-aircraft="2840">Bell UH-1H Iroquois (by ElonMusk(VrA)(LAC))</li>
            <li data-aircraft="5002">Beta Alia Prototype (N250UT) (by coolpilot11)</li>
            <li data-aircraft="2772">Boeing 737 Max 8 (SpiceJet) (by Spice_9)</li>
            <li data-aircraft="2769">Boeing 737 Max 8 (TUI) (by Spice_9)</li>
            <li data-aircraft="4140">Boeing 737-200 (by AriakimTaiyo)</li>
            <li data-aircraft="6131">Boeing 737-400 by TOMAIIM & (by X-75)</li>
            <li data-aircraft="5203">Boeing 737-600 by Luca & (by Spice_9)</li>
            <li data-aircraft="2003">Boeing 737-800 (by King  Solomon)</li>
            <li data-aircraft="3054">Boeing 737-800 [Spice9] (by Spice_9)</li>
            <li data-aircraft="5314">Boeing 747-100 SCA by JAaMDG & (by Jeffa)</li>
            <li data-aircraft="5527">Boeing 747-400 by JAaMDG & (by BOA93(EAA))</li>
            <li data-aircraft="5516">Boeing 747-400 LCF by Luca & (by JAaMDG)</li>
            <li data-aircraft="5409">Boeing 747-400D by JAaMDG & (by BOA93(EAA))</li>
            <li data-aircraft="252">Boeing 747-8 Freighter (by LRX)</li>
            <li data-aircraft="5193">Boeing 747-8i (by JAaMDG)</li>
            <li data-aircraft="5211">Boeing 747SP by JAaMDG & (by BOA93(EAA))</li>
            <li data-aircraft="238">Boeing 757-200 (by GX Development)</li>
            <li data-aircraft="4743">Boeing 757-300 (by GT[VRA])</li>
            <li data-aircraft="4745">Boeing 757-300wl (by GT[VRA])</li>
            <li data-aircraft="237">Boeing 767-300ER (by GX Development)</li>
            <li data-aircraft="4764">Boeing 767-400 (by GT[VRA])</li>
            <li data-aircraft="4402">Boeing 777 Freighter (by LRX)</li>
            <li data-aircraft="240">Boeing 777-300ER (by LRX)</li>
            <li data-aircraft="3179">Boeing 787-10 Dreamliner (British Airways) (by Spice_9)</li>
            <li data-aircraft="3180">Boeing 787-10 Dreamliner (Etihad) (by Spice_9)</li>
            <li data-aircraft="235">Boeing 787-8 (by GX Development)</li>
            <li data-aircraft="2386">Boeing 787-9 Dreamliner (by LRX)</li>
            <li data-aircraft="3575">Boeing 787-9(Spice9) (by Spice_9)</li>
            <li data-aircraft="3292">Boeing p8I Neptune (by Spice_9)</li>
            <li data-aircraft="2706">Bombardier CRJ 200 (by Aero281)</li>
            <li data-aircraft="3307">Bombardier CRJ-700 (by AriakimTaiyo)</li>
            <li data-aircraft="247">Bombardier Dash 8 Q400 (by LRX)</li>
            <li data-aircraft="5073">Bombardier Learjet 45 XR (by Spice_9)</li>
            <li data-aircraft="4398">Britten-Norman BN-2 Islander (Loganair) (by coolpilot11)</li>
            <li data-aircraft="4401">Britten-Norman BN-2 Islander (St. Barth Commuter) (by coolpilot11)</li>
            <li data-aircraft="2852">Cameron R-650 Rozière Balloon (by JAaMDG)</li>
            <li data-aircraft="2750">Caproni Stipa (by Echo_3)</li>
            <li data-aircraft="4251">Chance Vought F4U-1D Corsair (by JAaMDG)</li>
            <li data-aircraft="1069">Cirrus SR22 GTS Turbo (by LRX)</li>
            <li data-aircraft="2461">Cirrus Vision Jet/SF50 G2 (by Eco())</li>
            <li data-aircraft="5551">Comac C919-100 (by JAaMDG)</li>
            <li data-aircraft="2004">CRJ-900 (by King  Solomon)</li>
            <li data-aircraft="5499">CubCrafters CC19 XCub (by AriakimTaiyo)</li>
            <li data-aircraft="3617">Dassault Mirage 2000-5 (by ElonMusk(VrA)(LAC))</li>
            <li data-aircraft="3289">Dornier 228-200 (by Spice_9)</li>
            <li data-aircraft="3436">Dornier do228-100 (Coast Gaurd) (by Spice_9)</li>
            <li data-aircraft="5566">Embraer E175 by JAaMDG (by Plane2222222)</li>
            <li data-aircraft="236">Embraer E190 (by GX Development)</li>
            <li data-aircraft="3036">Embraer E195-E2 (by GT[VRA])</li>
            <li data-aircraft="2943">Embraer EMB120 Brasillia  (by GT[VRA])</li>
            <li data-aircraft="3341">Embraer ERJ-170 (by AriakimTaiyo)</li>
            <li data-aircraft="2700">Embraer ERJ-195AR (Breeze) (by Featherway(GE))</li>
            <li data-aircraft="4017">Embraer ERJ145LR (by Spice 9) & (by GT[VRA])</li>
            <li data-aircraft="2581">F-14B Tomcat  (by Eco())</li>
            <li data-aircraft="3591">F-15C Eagle (by AriakimTaiyo)</li>
            <li data-aircraft="2857">F-22 Raptor (by SpaceRage)</li>
            <li data-aircraft="5229">F-35B Lightning II (by JAaMDG)</li>
            <li data-aircraft="2844">Falcon 9 (by Echo_3)</li>
            <li data-aircraft="4949">Goodyear Blimp (by BritishPilot[GeoAD])</li>
            <li data-aircraft="3460">Grumman E-2C Hawkeye (by ElonMusk(VrA)(LAC))</li>
            <li data-aircraft="2786">Grumman JF2-5 Duck (by Echo_3)</li>
            <li data-aircraft="5038">Lockheed L-1011-1 (by AriakimTaiyo)</li>
            <li data-aircraft="3049">Lockheed Martin P-791 (LMH-1) (by JAaMDG)</li>
            <li data-aircraft="2364">Lockheed SR-71A Blackbird (by BritishPilot[GeoAD])</li>
            <li data-aircraft="2989">MQ9B Reaper (by Aero281)</li>
            <li data-aircraft="2556">Northrop Grumman B-2 Spirit (by NS-Studios)</li>
            <li data-aircraft="5431">Northrop YF-23 (by MirageModels)</li>
            <li data-aircraft="2976">Pilatus PC12 (by GT[VRA])</li>
            <li data-aircraft="3109">Pilatus PC24 (by GT[VRA])</li>
            <li data-aircraft="4390">Piper PA-28 Floatplane (by coolpilot11)</li>
            <li data-aircraft="4197">Robinson R-22 (by (CCDev)DevHunter77)</li>
            <li data-aircraft="4090">Robinson R-44 (by (CCDev)DevHunter77)</li>
            <li data-aircraft="2892">SAAB 340 (by Spice_9)</li>
            <li data-aircraft="2726">Scaled Composites 339 SpaceShipTwo (by JAaMDG)</li>
            <li data-aircraft="2752">Scaled Composites 348 WhiteKnightTwo (by JAaMDG)</li>
            <li data-aircraft="2806">Sikorsky S-97 Raider (by JAaMDG)</li>
            <li data-aircraft="5061">Sonex-B Kit (Jabiru 3300) (by TurboMaximus)</li>
            <li data-aircraft="2953">Space Shuttle Atlantis (OV-104) (by JAaMDG)</li>
            <li data-aircraft="4341">Spirit of St louis (by Echo_3)</li>
            <li data-aircraft="2808">Supermarine Spitfire Mk XIV (by Eco())</li>
            <li data-aircraft="3211">UTVA75 (by GT[VRA])</li>
            <li data-aircraft="4596">Vans RV6 (by coolpilot11)</li>
            <li data-aircraft="2968">Windward Performance Perlan II (by JAaMDG)</li>
            <li data-aircraft="4409">Zenith Stol CH701 (by coolpilot11)</li>
        </ul>
    </li>
    <li data-aircraft="1" class="">
        <img data-deferredsrc="images/planes/cub.png"/>
        Piper Cub
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="1" data-livery="0">
                    <img data-deferredsrc="images/planes/cub_0.png"/>Yellow
                </div>
                <div data-aircraft="1" data-livery="1">
                    <img data-deferredsrc="images/planes/cub_1.png"/>Red
                </div>
            </div>
        </div"></li><li data-aircraft="2" class=""><img data-deferredsrc="images/planes/c172.png"/>Cessna 172<div class="geofs-liveriesgeofs-list-collapsible-item" data-noscroll="true"><div class="geofs-collapsible"><div data-aircraft="2" data-livery="0"><img data-deferredsrc="images/planes/c172_0.png"/>Classic</div><div data-aircraft="2" data-livery="1"><img data-deferredsrc="images/planes/c172_1.png"/>Modern</div></div></div">
    </li>
    <li data-aircraft="3" class="">
        <img data-deferredsrc="images/planes/alphajet.png"/>Alphajet PAF
    </li>
    <li data-aircraft="4" class="">
        <img data-deferredsrc="images/planes/737-700.png"/>
        Boeing 737-700
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="4" data-livery="0">
                    <img data-deferredsrc="images/planes/737-700_0.png"/>KLM
                </div>
                <div data-aircraft="4" data-livery="1">
                    <img data-deferredsrc="images/planes/737-700_1.png"/>United Airlines
                </div>
                <div data-aircraft="4" data-livery="2">
                    <img data-deferredsrc="images/planes/737-700_2.png"/>ANA
                </div>
                <div data-aircraft="4" data-livery="3">
                    <img data-deferredsrc="images/planes/737-700_3.png"/>Southwest
                </div>
                <div data-aircraft="4" data-livery="4">
                    <img data-deferredsrc="images/planes/737-700_4.png"/>WestJet
                </div>
                <div data-aircraft="4" data-livery="5">
                    <img data-deferredsrc="images/planes/737-700_5.png"/>GOL
                </div>
            </div>
        </div"></li><li data-aircraft="5" class=""><img data-deferredsrc="images/planes/phenom.png"/>Embraer Phenom 100</li><li data-aircraft="6" class=""><img data-deferredsrc="images/planes/dhc6.png"/>de Havilland DHC6 Twin Otter<div class="geofs-liveriesgeofs-list-collapsible-item" data-noscroll="true"><div class="geofs-collapsible"><div data-aircraft="6" data-livery="0"><img data-deferredsrc="images/planes/dhc6_0.png"/>Flybe</div><div data-aircraft="6" data-livery="1"><img data-deferredsrc="images/planes/dhc6_1.png"/>Canadian Air Force</div><div data-aircraft="6" data-livery="2"><img data-deferredsrc="images/planes/dhc6_2.png"/>Air Moorea</div><div data-aircraft="6" data-livery="3"><img data-deferredsrc="images/planes/dhc6_3.png"/> White Tail</div></div></div">
    </li>
    <li data-aircraft="7" class="">
        <img data-deferredsrc="images/planes/f16.png"/>F-16 Fighting Falcon
    </li>
    <li data-aircraft="8" class="">
        <img data-deferredsrc="images/planes/pitts.png"/>
        Pitts Special S1
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="8" data-livery="0">
                    <img data-deferredsrc="images/planes/pitts_0.png"/>Classic Red
                </div>
                <div data-aircraft="8" data-livery="1">
                    <img data-deferredsrc="images/planes/pitts_1.png"/>Airshow
                </div>
            </div>
        </div"></li><li data-aircraft="9" class=""><img data-deferredsrc="images/planes/ec135.png"/>Eurocopter EC135</li><li data-aircraft="10" class=""><img data-deferredsrc="images/planes/a380.png"/>Airbus A380<div class="geofs-liveriesgeofs-list-collapsible-item" data-noscroll="true"><div class="geofs-collapsible"><div data-aircraft="10" data-livery="0"><img data-deferredsrc="images/planes/a380_0.png"/>Emirates</div><div data-aircraft="10" data-livery="1"><img data-deferredsrc="images/planes/a380_1.png"/>Air France</div><div data-aircraft="10" data-livery="2"><img data-deferredsrc="images/planes/a380_2.png"/>Qantas</div></div></div">
    </li>
    <li data-aircraft="11" class="">
        <img data-deferredsrc="images/planes/silent2.png"/>Alisport Silent 2 Electro
    </li>
    <li data-aircraft="12" class="">
        <img data-deferredsrc="images/planes/pc7.png"/>
        Pilatus PC-7 Mk-I
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="12" data-livery="0">
                    <img data-deferredsrc="images/planes/pc7_0.png"/>HL Black
                </div>
                <div data-aircraft="12" data-livery="1">
                    <img data-deferredsrc="images/planes/pc7_1.png"/>SAF Red White
                </div>
                <div data-aircraft="12" data-livery="2">
                    <img data-deferredsrc="images/planes/pc7_2.png"/>SAF Orange
                </div>
                <div data-aircraft="12" data-livery="3">
                    <img data-deferredsrc="images/planes/pc7_3.png"/>Factory Red
                </div>
            </div>
        </div"></li><li data-aircraft="13" class=""><img data-deferredsrc="images/planes/dhc2.png"/>de Havilland Canada DHC-2 Beaver<div class="geofs-liveriesgeofs-list-collapsible-item" data-noscroll="true"><div class="geofs-collapsible"><div data-aircraft="13" data-livery="0"><img data-deferredsrc="images/planes/dhc2_0.png"/>EPOCH Alaska Air</div><div data-aircraft="13" data-livery="1"><img data-deferredsrc="images/planes/dhc2_1.png"/>N963DH Green-White</div><div data-aircraft="13" data-livery="2"><img data-deferredsrc="images/planes/dhc2_2.png"/>N323KT Red-White</div><div data-aircraft="13" data-livery="3"><img data-deferredsrc="images/planes/dhc2_3.png"/>N295B White-Brown</div><div data-aircraft="13" data-livery="4"><img data-deferredsrc="images/planes/dhc2_4.png"/>Lakeland Airways</div><div data-aircraft="13" data-livery="5"><img data-deferredsrc="images/planes/dhc2_5.png"/>Kenmore 66Z</div><div data-aircraft="13" data-livery="6"><img data-deferredsrc="images/planes/dhc2_6.png"/>Clipper Aviation</div><div data-aircraft="13" data-livery="7"><img data-deferredsrc="images/planes/dhc2_7.png"/>Civil Air Patrol</div><div data-aircraft="13" data-livery="8"><img data-deferredsrc="images/planes/dhc2_8.png"/>Alaska Forestry</div></div></div">
    </li>
    <li data-aircraft="14" class="">
        <img data-deferredsrc="images/planes/cricri.png"/>
        Colomban MC-15 Cri-cri
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="14" data-livery="0">
                    <img data-deferredsrc="images/planes/cricri_0.png"/>Criquet
                </div>
                <div data-aircraft="14" data-livery="1">
                    <img data-deferredsrc="images/planes/cricri_1.png"/>Bleu Blanc Rouge
                </div>
                <div data-aircraft="14" data-livery="2">
                    <img data-deferredsrc="images/planes/cricri_2.png"/>Camo
                </div>
            </div>
        </div"></li><li data-aircraft="15" class=""><img data-deferredsrc="images/planes/p38.png"/>Lockheed P-38 Lightning F-5B<div class="geofs-liveriesgeofs-list-collapsible-item" data-noscroll="true"><div class="geofs-collapsible"><div data-aircraft="15" data-livery="0"><img data-deferredsrc="images/planes/p38_0.png"/>Navy</div><div data-aircraft="15" data-livery="1"><img data-deferredsrc="images/planes/p38_1.png"/>Saint-Exupery</div></div></div">
    </li>
    <li data-aircraft="16" class="">
        <img data-deferredsrc="images/planes/dc3.png"/>Douglas DC-3
    </li>
    <li data-aircraft="18" class="">
        <img data-deferredsrc="images/planes/su35.png"/>
        Sukhoi Su-35
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="18" data-livery="0">
                    <img data-deferredsrc="images/planes/su35_0.png"/>Akula 35
                </div>
                <div data-aircraft="18" data-livery="1">
                    <img data-deferredsrc="images/planes/su35_1.png"/>Russia Bort 01
                </div>
                <div data-aircraft="18" data-livery="2">
                    <img data-deferredsrc="images/planes/su35_2.png"/>Russia Bort 06
                </div>
                <div data-aircraft="18" data-livery="3">
                    <img data-deferredsrc="images/planes/su35_3.png"/>Russia Bort 901
                </div>
                <div data-aircraft="18" data-livery="4">
                    <img data-deferredsrc="images/planes/su35_4.png"/>Ho Ho Ho
                </div>
            </div>
        </div"></li><li data-aircraft="20" class=""><img data-deferredsrc="images/planes/concorde.png"/>Concorde<div class="geofs-liveriesgeofs-list-collapsible-item" data-noscroll="true"><div class="geofs-collapsible"><div data-aircraft="20" data-livery="0"><img data-deferredsrc="images/planes/concorde_0.png"/>British Airways</div><div data-aircraft="20" data-livery="1"><img data-deferredsrc="images/planes/concorde_1.png"/>Air France</div><div data-aircraft="20" data-livery="2"><img data-deferredsrc="images/planes/concorde_2.png"/>Pepsi</div></div></div">
    </li>
    <li data-aircraft="21" class="">
        <img data-deferredsrc="images/planes/zlin.png"/>Zlin Z-50
    </li>
    <li data-aircraft="23" class="">
        <img data-deferredsrc="images/planes/pa28.png"/>Piper PA-28 161 Warrior II Aerobility
    </li>
    <li data-aircraft="24" class="">
        <img data-deferredsrc="images/planes/a350.png"/>
        Airbus A350
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="24" data-livery="0">
                    <img data-deferredsrc="images/planes/a350_0.png"/>Airbus
                </div>
                <div data-aircraft="24" data-livery="1">
                    <img data-deferredsrc="images/planes/a350_1.png"/>Delta
                </div>
                <div data-aircraft="24" data-livery="2">
                    <img data-deferredsrc="images/planes/a350_2.png"/>Air France
                </div>
            </div>
        </div"></li><li data-aircraft="25" class=""><img data-deferredsrc="images/planes/777-300.png"/>Boeing 777-300ER<div class="geofs-liveriesgeofs-list-collapsible-item" data-noscroll="true"><div class="geofs-collapsible"><div data-aircraft="25" data-livery="0"><img data-deferredsrc="images/planes/777-300_0.png"/>American Airlines</div><div data-aircraft="25" data-livery="1"><img data-deferredsrc="images/planes/777-300_1.png"/>AA Retro</div><div data-aircraft="25" data-livery="2"><img data-deferredsrc="images/planes/777-300_2.png"/>White Tail</div></div></div">
    </li>
    <li data-aircraft="26" class="">
        <img data-deferredsrc="images/planes/an140.png"/>Antonov An-140
    </li>
    <li data-aircraft="27" class="">
        <img data-deferredsrc="images/planes/fa18.png"/>
        Boeing F/A-18F Super Hornet
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="27" data-livery="0">
                    <img data-deferredsrc="images/planes/fa18_0.png"/>Blue Angels
                </div>
                <div data-aircraft="27" data-livery="1">
                    <img data-deferredsrc="images/planes/fa18_1.png"/>Navy
                </div>
            </div>
        </div"></li><li data-aircraft="28" class=""><img data-deferredsrc="images/planes/b55.png"/>Beechcraft Baron B55</li><li data-aircraft="29" class=""><img data-deferredsrc="images/planes/rafale.png"/>Dassault Rafale<div class="geofs-liveriesgeofs-list-collapsible-item" data-noscroll="true"><div class="geofs-collapsible"><div data-aircraft="29" data-livery="0"><img data-deferredsrc="images/planes/rafale_0.png"/>M</div><div data-aircraft="29" data-livery="1"><img data-deferredsrc="images/planes/rafale_1.png"/> Solo Display 2025</div></div></div">
    </li>
    <li data-aircraft="31" class="">
        <img data-deferredsrc="images/planes/potez25.png"/>Potez 25
    </li>
    <li data-aircraft="32" class="">
        <img data-deferredsrc="images/planes/t38.png"/>
        Northrop T-38 Talon
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="32" data-livery="0">
                    <img data-deferredsrc="images/planes/t38_0.png"/>NASA
                </div>
                <div data-aircraft="32" data-livery="1">
                    <img data-deferredsrc="images/planes/t38_1.png"/>Bears
                </div>
                <div data-aircraft="32" data-livery="2">
                    <img data-deferredsrc="images/planes/t38_2.png"/>USAF
                </div>
            </div>
        </div"></li><li data-aircraft="40" class=""><img data-deferredsrc="images/planes/sportstar.png"/>Evektor Sportstar</li><li data-aircraft="41" class=""><img data-deferredsrc="images/planes/jantar.png"/>szd-48-3 Jantar</li><li data-aircraft="50" class=""><img data-deferredsrc="images/planes/paraglider.png"/>Paraglider</li><li data-aircraft="51" class=""><img data-deferredsrc="images/planes/tom.png"/>Major Tom (hot air balloon)<div class="geofs-liveriesgeofs-list-collapsible-item" data-noscroll="true"><div class="geofs-collapsible"><div data-aircraft="51" data-livery="0"><img data-deferredsrc="images/planes/tom_0.png"/>Major Tom</div><div data-aircraft="51" data-livery="1"><img data-deferredsrc="images/planes/tom_1.png"/>Pixels</div><div data-aircraft="51" data-livery="2"><img data-deferredsrc="images/planes/tom_2.png"/>GeoFS</div><div data-aircraft="51" data-livery="3"><img data-deferredsrc="images/planes/tom_3.png"/>Losanges</div><div data-aircraft="51" data-livery="4"><img data-deferredsrc="images/planes/tom_4.png"/>Red</div><div data-aircraft="51" data-livery="5"><img data-deferredsrc="images/planes/tom_5.png"/>Orange</div><div data-aircraft="51" data-livery="6"><img data-deferredsrc="images/planes/tom_6.png"/>Scale</div><div data-aircraft="51" data-livery="7"><img data-deferredsrc="images/planes/tom_7.png"/>Christmas</div></div></div">
    </li>
    <li data-aircraft="52" class="">
        <img data-deferredsrc="images/planes/hughes.png"/>Hughes 269a/TH-55 Osage
    </li>
    <li data-aircraft="53" class="">
        <img data-deferredsrc="images/planes/goat.png"/>Goat Airchair
    </li>
    <li data-aircraft="102" class="">
        <img data-deferredsrc="images/planes/2cv.png"/>
        Citroen 2CV
        <div class="geofs-liveries geofs-list-collapsible-item" data-noscroll="true">
            <div class="geofs-collapsible">
                <div data-aircraft="102" data-livery="0">
                    <img data-deferredsrc="images/planes/2cv_0.png"/>Bleue
                </div>
                <div data-aircraft="102" data-livery="1">
                    <img data-deferredsrc="images/planes/2cv_1.png"/>Yellow
                </div>
                <div data-aircraft="102" data-livery="2">
                    <img data-deferredsrc="images/planes/2cv_2.png"/>Green
                </div>
                <div data-aircraft="102" data-livery="3">
                    <img data-deferredsrc="images/planes/2cv_3.png"/>Red
                </div>
                <div data-aircraft="102" data-livery="4">
                    <img data-deferredsrc="images/planes/2cv_4.png"/>Charleston
                </div>
            </div>
            </ div "></li><li data-aircraft=" 103 " class=" "><img data-deferredsrc=" images/planes/wingsuit.png "/>Wingsuit</li></ul>

<script>
    // de-obfuscate path so Googlebot does not crawl and follow therese as links
    for (var i in geofs.aircraftList) {
        geofs.aircraftList[i].path = geofs.aircraftList[i].dir.replace(/\|/gi, '/');
    }
</script>
        <ul class=" geofs-list geofs-toggle-panel geofs-player-list geofs-authenticated " data-onshow=" {ui.initPlayerList()} " data-onhide=" {ui.clearPlayerList()} "></ul>

        <div class=" geofs-hd-list geofs-toggle-panel geofs-onlyForApp " data-parentwidth=" 100%" data-noblur=" true ">
            <div class=" geofs-payment-view "></div>
        </div>

        <!-- Navigation panel -->
        <div class=" geofs-map-list geofs-toggle-panel " data-parentzindex=" 40 " data-onshow=" {ui.openMap()} " data-onhide=" {ui.closeMap()} " data-noblur=" true ">
            <label style=" position:absolute;bottom:50px;left:60px;" class=" mdl-switch mdl-js-switch mdl-js-ripple-effect " for=" centerMap " title=" Automatically recenter map ">
		<input type=" checkbox " id=" centerMap " class=" mdl-switch__input " data-gespref=" geofs.preferences.interface.recenterMap " data-update=" {geofs.savePreferences()} " />
                <span class=" mdl-switch__label ">Recenter</span>
            </label>
            <label style=" position:absolute;bottom:10px;left:60px;" class=" mdl-switch mdl-js-switch mdl-js-ripple-effect " for=" drawFlightPath " title=" Show recorded flight path ">
                <input type=" checkbox " id=" drawFlightPath " class=" mdl-switch__input " data-gespref=" geofs.preferences.interface.drawFlightPath " data-update=" {flight.recorder.setPathDrawState()} ">
                <span class=" mdl-switch__label ">Show path</span>
            </label>
            <div class=" geofs-flightPlan-pad control-pad " title=" Open flight plan planel " onclick=" geofs.flightPlan.toggle();">
                <div class=" control-pad-label transp-pad ">FLIGHT PLAN</div>
            </div>
            <div class=" control-pad geofs-flightPlan geofs-stopKeyboardPropagation geofs-stopKeyupPropagation ">
                <div class=" geofs-flightPlanHeader ">
                    <span>WPT</span><span style=" text-align:right;">DST</span><span style=" text-align:right;">TRK</span><span>ALT</span><span>SPD</span>
                    <button class=" mdl-button mdl-js-button mdl-button--icon " title=" Clear Flight Plan " style=" float:right;"><i class=" material-icons " onclick=" geofs.flightPlan.clear();">delete</i></button>
                    <span title=" Distance to Destination " class=" flightPlanDistance " style=" float:right;"></span>
                </div>
                <div class=" geofs-flightPlanList "></div>
                <div class=" geofs-addWaypoint control-pad " id=" flightPlanWaypoint ">
                    <div class=" mdl-textfield mdl-js-textfield " style=" width:280px;">
                        <input class=" mdl-textfield__input geofs-addWaypointInput " type=" text " id=" addWaypoint " onchange=" geofs.flightPlan.searchWaypoint(this);">
                        <label class=" mdl-textfield__label " for=" addWaypoint ">FIX - WAYPOINT - ICAO - LAT,LON</label>
                    </div>
                    <div class=" geofs-addWaypointButton control-pad control-pad-label " onclick=" geofs.flightPlan.searchWaypoint(this);">
                        <i class=" material-icons " style=" position:absolute;left:1px;top:1px;">add_circle</i> Add waypoint
                    </div>
                    <button class=" mdl-button mdl-js-button mdl-button--icon geofs-flightplanAction " title=" Paste flightplan from clipboard " onclick=" geofs.flightPlan.paste();"><i class=" material-icons ">content_paste</i></button>
                    <button class=" mdl-button mdl-js-button mdl-button--icon geofs-flightplanAction " title=" Copy flightplan to clipboard " onclick=" geofs.flightPlan.copy();"><i class=" material-icons ">content_copy</i></button>
                    <label class=" mdl-button mdl-js-button mdl-button--icon geofs-flightplanAction " title=" Open flightplan file (JSON) " for=" planfileupload "><i class=" material-icons ">folder_open</i></label><input type=" file " id=" planfileupload " style=" display:none;" onchange=" geofs.flightPlan.upload(this);"/>
                    <a class=" mdl-button mdl-js-button mdl-button--icon geofs-flightplanAction " title=" Save flightplan locally " onclick=" geofs.flightPlan.download(this);"><i class=" material-icons ">save</i></a>
                    <a class=" geofs-flightplanAction simBriefImportButton " title=" Import SimBrief Flight Plan " onclick=" geofs.flightPlan.importSimBrief();"><img data-deferredsrc=" /images/simbriefbutton.png " style=" width:22px " /></a>
                </div>
            </div>
            <div class=" geofs-map-viewport geofs-stopMousePropagation "></div>

            <!-- Legacy autopilot -->
            <div class=" geofs-autopilot geofs-stopKeyboardPropagation ">
                <h6>Autopilot</h6>
                <button class=" mdl-button mdl-js-button mdl-button--raised geofs-autopilot-toggle " onclick=" geofs.autopilot.toggle();" title=" Toggle autopilot on/off-[A] ">Disengaged</button>
                <div class=" geofs-autopilot-displays ">
                    <label>
                        Altitude
                        <input type=" number " placeholder=" 00000 " min=" 0 " step=" 1000 " class=" geofs-autopilot-altitude " onchange=" geofs.autopilot.setAltitude(this.value);">
                        <span>Ft.</span>
                    </label>
                    <label>
                        Heading
                        <input type=" number " placeholder=" 000 " min=" 0 " max=" 359 " step=" 1 " class=" geofs-autopilot-course " onchange=" geofs.autopilot.setCourse(this.value);">
                        <span>Deg.</span>
                    </label>
                    <label>
                        Speed
                        <input type=" number " placeholder=" 0 " min=" 0 " step=" 10 " class=" geofs-autopilot-speed geofs-autopilot-kias " onchange=" geofs.autopilot.setSpeed(this.value);">
                        <span>Kts.</span>
                    </label>
                </div>
            </div>

        </div>

        <!-- Debug panel -->
        <div class=" geofs-debug geofs-list geofs-toggle-panel " data-onshow=" {geofs.debug.turnOn()} " data-onhide=" {geofs.debug.turnOff()} " data-noblur=" true ">
            <div class=" geofs-debugFrame ">
                <label>Part name<input type=" text " class=" debugPartName " /></label>
                <label>Collision point index<input title=" collision point index " style=" width:20px;" class=" debugCollisionPointIndex " /></label>
                <br/><textarea class=" debugPartData "></textarea>
                <br/><label>Break on animation value<input type=" text " class=" debugAnimationValue " /></label>
                <br/><label>Output value<input type=" text " class=" debugOutputProperty " /></label>
                <label class=" checkbox ">Break on Part Name<input type=" checkbox " class=" debugBreakOnPartName " title=" Break on part name "/></label>
                <label class=" checkbox ">Force Source Point<input type=" checkbox " class=" debugShowForceSource " title=" force source point "/></label>
                <label class=" checkbox ">Force Direction<input type=" checkbox " class=" debugShowForceDirection " title=" Force direction "/></label>
                <label class=" checkbox ">Local Position<input type=" checkbox " class=" debugShowLocalPosition " title=" Local position "/></label>
                <label class=" checkbox ">suspension Origin<input type=" checkbox " class=" debugShowsuspensionOrigin " title=" Local position "/></label>
                <button class=" btn btn-warning " onclick=" geofs.killCache='?killcache='+Date.now();geofs.debugResetAircraft=true;">Clear cache</button>
                <button class=" btn " onclick=" geofs.aircraft.instance.change(geofs.aircraft.instance.id,null,/*forceReload*/ true,/*forceReset*/ false);">Just Reload</button>
                <button class=" btn " onclick=" geofs.aircraft.instance.change(geofs.aircraft.instance.id,null,/*forceReload*/ true,/*forceReset*/ true);">Full Reload</button>
                <br/>
                <label>Object id<input type=" text " class=" objectId " /></label>
                <div class=" geofs-debugObjectLlaHtr "></div>
                ---------------- logs ------------------
                <div class=" geofs-debugWatch "></div>
                <div class=" geofs-debugLog "></div>
            </div>
        </div>
    </div>

    <a href="/ " class=" geofs-home-button geofs-hideForApp " style=" z-index:30;" title=" GeoFS home page "><i class=" material-icons "></i></a>

    
        <div class=" geofs-adbanner geofs-adsense-container ">

            <style>
                .geofs-adbanner ins {
		    	  display: block;
                    width: 300px;
                    max-width: 300px;
                    min-width: 160px;
                }

                @media screen and (max-width: 1600px) {
                    .geofs-adbanner ins {
                        width: 160px;
                    }
                }

                @media screen and (orientation: portrait) {
                    .geofs-adbanner ins {
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: 162px;
                        height: 162px;
                    }
                }

            </style>

            <div class=" geofs-refreshTarget ">

                <div class=" geofs-adsBlockedMessage " style=" text-align:center;">
    
<a href=" https://geofs.myspreadshop.com " target=" _blank " style=" display:inline-block;text-align:center;width:100%;height:100%;">
<img data-deferredsrc=" /images/ba/merch_skyscraper.jpg " style=" max-width:160px;max-height:100%;" /></a></div>
                <script data-deferredsrc=" //pagead2.googlesyndication.com/pagead/js/adsbygoogle.js "></script>
                <ins class=" adsbygoogle " data-ad-client=" ca-pub-1808592532341984 " data-ad-slot=" 5302287636 " data-ad-format=" vertical "></ins>
            </div>
        </div>

        <script>

            (adsbygoogle = window.adsbygoogle || []).push({});

            window.executeOnEventDone('afterDeferredload', function() {

                geofs.lastFlyTo = new Date().getTime();
		        geofs.adCount = 1;
                $(document).on('flyto', function() {
                    var t = new Date().getTime();
                    if (t - geofs.lastFlyTo > 40000) {

                        if (window.adsBlocked) {
                            if (window.innerWidth <= 800) {
                                $('.geofs-refreshTarget').htmlView('load', '/pages/common/includes/ba/apps.php?type=2');
                            }
                            else {
                                $('.geofs-refreshTarget').htmlView('load', '/pages/common/includes/ba/loader.php?type=2');
                            }
                        }
                        else {
                            $('.geofs-refreshTarget').empty().html('<scr'+'ipt async src=" //pagead2.googlesyndication.com/pagead/js/adsbygoogle.js "><'+'/scr'+'ipt><ins class=" adsbygoogle " data-ad-client=" ca-pub-1808592532341984 " data-ad-slot=" 5302287636 " data-ad-format=" vertical "><'+'/ins><scr'+'ipt>(adsbygoogle = window.adsbygoogle || []).push({});<'+'/scr'+'ipt>');
                        }
                        geofs.adCount++;
                        geofs.lastFlyTo = t;
                    }
                });
            });
        </script>

    
</body>
</html>


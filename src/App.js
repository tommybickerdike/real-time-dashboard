import React, { Component, Fragment } from 'react';
import {GoogleAPI, GoogleLogin, GoogleLogout, CustomGoogleLogin, CustomGoogleLogout, googleGetBasicProfil, googleGetAuthResponse} from 'react-google-oauth'
import GoogleMapReact from 'google-map-react';
import MAPSTYLES from './map.js';
import './styles.css';

// google map marker
const Marker = ({ text }) => 
    <div className="marker"><span>{text}</span></div>;

// svg polling timer
const StatusSVG = ( { strokeDasharray }) =>             
    <div className="status">
        <div className="chart--donut">
            <svg viewBox="0 0 40 40">
                <circle className="chart--donut--segment" cx="20" cy="20" r="15.91549430918954"></circle>
                <circle className="chart--donut--segment" cx="20" cy="20" r="15.91549430918954" strokeDasharray={ strokeDasharray }></circle>
            </svg>
        </div>
    </div>

// settings form
const  Settings = ( { ...props, handleSettingsUpdate, handleSettingsValue } ) => 
    <form className="settings">
        {["viewID","googleMapAPI","clientID","property"].map(item => 
            <Fragment>
                <label>{ item }</label>
                <input 
                    type="text" 
                    value={ props[item] } 
                    onChange={(e) => handleSettingsValue(e, item)}
                />
            </Fragment>
        )}
        <button 
            className="ui--button"
            onClick={(e) => handleSettingsUpdate(e)}
            >
            Proceed
        </button>
    </form>
class App extends Component {
    static defaultProps = {
        // refer to my Medium article for instructions
        // on how to get all these bits.
        keys : {
            viewID : 'look in Google Analytics',
            googleMapAPI: 'api key https://console.cloud.google.com/apis',
            clientID : 'OAuth 2.0 client ID https://console.cloud.google.com/apis',
            scope: 'https://www.googleapis.com/auth/analytics',
            property: 'your-domain.com'
        },
        polling : {
            interval : 10 //seconds
        }
    }
    constructor(defaultProps) { 
        super(defaultProps);
        this.state = {
            ...this.props.keys,
            apiURL : 'https://www.googleapis.com/analytics/v3/data/realtime?ids=ga:',
            apiOptions : '&metrics=rt:activeUsers&dimensions=rt:country,rt:city,rt:latitude,rt:longitude',
            userName : false,
            error : "Login Required",
            pause : false, // if true... app stops polling API
            plot : [],
            stats : [],
            total : 0,
            strokeDasharray : "0 100",
            center : {
                lat: 49.281057,
                lng: -123.107638
            },
            zoom : 2,
            settings : false
        };
    }
    componentDidMount() {
        this.hydrateStateWithLocalStorage();
    }
    // super thanks to https://github.com/ryanjyost for the localStorage ja
    saveStateToLocalStorage = () =>  {
        for (let key in this.state) {
            localStorage.setItem(key, JSON.stringify(this.state[key]));
        }
    }
    hydrateStateWithLocalStorage = () =>  {
        for (let key in this.state) {
            if (localStorage.hasOwnProperty(key)) {
                let value = localStorage.getItem(key);
                try {
                    value = JSON.parse(value);
                    this.setState({ [key]: value });
                } catch (e) {
                    this.setState({ [key]: value });
                }
            }
        }
    }
    fetchData = () => {
        let _authResp = googleGetAuthResponse();
        console.log("Obtenir les données!")
        fetch(this.state.apiURL + this.state.viewID + this.state.apiOptions + "&access_token=" + _authResp.accessToken)
            .then(response => response.json())
            .then(result => {
                if (result.error)
                    this.error(result.error.message);
                else //if (result.totalsForAllResults['rt:activeUsers'] > 0)
                    this.shapeData(result);
            })
            .catch(error => console.log('error:', error));
    }
    uniqueArray = (arrArg) => {
        return arrArg.filter((elem, pos, arr) => {
            return arr.indexOf(elem) == pos;
        });
    }
    shapeData = (results) => {
        let _total = results.totalsForAllResults['rt:activeUsers'],
            _incoming = results.rows,
            _plot = [],
            _center = this.state.center,
            _stats =  this.state.stats,
            _error = this.state.error
        
        _incoming = results.rows.map((stat, index) => {
            let _city = (stat[1] != "zz") ? stat[1] + ", " : "",
                _country = stat[0],
                _str = `${_city}${_country}`;
            
            if (stat[2]) {
                _plot.push([`${stat[2]}, ${stat[3]}, ${_city}`]);
                if (index ===0) 
                    _center = {
                        lat: Number(stat[2]),
                        lng: Number(stat[3])
                    };
            }
            return _str;
        })
        
        if (_total > 0) {
            _stats = this.uniqueArray(_stats.concat(_incoming));
            // drop old ones
            _stats.length = 10;
            // remove any previous error messages
            _error = null;
        }

        this.setState({
            stats : (_total > 0) ? _stats : [],
            plot : _plot,
            center : _center,
            total : _total,
            error : _error 
        });
/*

        let objDiv = document.getElementById("app");
        objDiv.scrollTop = objDiv.scrollHeight;
*/
    }
    error = (message) => {
        this.setState({
            error : message,
            pause : true
        })
    }
    poll = () => {
        // polling @ _interval seconds
        let _last = 0,
            _timer = 1,
            _interval = this.props.polling.interval;
        
        let render = (_now) => {
            if(!_last || _now - _last >= _interval * 1000 && !this.state.pause) {
                _last = _now;
                _timer = 1;
                this.fetchData();
            } else {
                _timer++;
                let _perc = (_timer / (60 * _interval) * 100);
                this.updateDisplayTimer(_perc);
            }
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }
    handleLogout = () => {
        console.log("logged out")
        window.location.reload();
    }
    handleLogin = (data) => {
        const _user = googleGetBasicProfil();
        this.poll();
        this.setState({
            userName : _user.name,
            error : "Waiting for visitors..."
        })
    }
    handleSettingsValue = (e, label) => {
        this.setState({
            [label] : e.target.value
        }) 
    }
    handleSettingsUpdate = (e) => {
        e.preventDefault();
        this.saveStateToLocalStorage();
        this.setState({
            settings : !this.state.settings
        })
    }
    updateDisplayTimer = (val) => {
        // messing with SVG for countdown timer
        let _val = Math.floor(val),
            _a = _val,
            _b = 100 - _val;
        
        this.setState({
            strokeDasharray : `${_a} ${_b}`
        })
        
    }
    renderNav = () => {
        let _user = this.state.userName;
        return  (    
            <nav>
                <div>Real-Time &mdash; { this.state.property }</div>
                <GoogleAPI 
                    clientId={this.state.clientID}
                    scope={this.props.keys.scope}
                    prompt="consent"
                    onUpdateSigninStatus={this.handleLogin}
                >
                    <div>
                        { _user && 
                            <span>
                                {_user}
                                <CustomGoogleLogout 
                                    onLogoutSuccess={this.handleLogout} 
                                />
                            </span>
                        }
                        { !_user &&
                            <CustomGoogleLogin />
                        }
                    </div>
                </GoogleAPI>
            </nav>
        )
    }
    renderMap = () => {
        const _center = this.state.center,
            _plot = this.state.plot;
        
        if (_plot) 
            return (
                <div className="map--wrapper">
                    <GoogleMapReact
                        bootstrapURLKeys={{ key: this.state.googleMapAPI }}
                        options={{ styles: MAPSTYLES }}
                        defaultCenter={_center}
                        defaultZoom={this.state.zoom}
                        center={_center}
                        zoom={2}
                    >
                    {_plot && _plot.map( (plot, index) => {
                        let pt = plot[0].split(", ");
                        return  <Marker key={`marker-${index}`}
                                    lat={ pt[0] }
                                    lng={ pt[1] }
                                    text={ pt[2] }
                                />
                        }
                    )}
                    </GoogleMapReact>
                </div>
        )
    }
    renderStats = () => {
        if (this.state.total < 1) 
            return
        else 
            return this.state.stats.map((stat, index) =>                     
                <div className="stat" key={`stat-${index}`}>
                    <h1>{stat}</h1>
                </div>
            )
    }
    render() {
        let Status = () => <StatusSVG strokeDasharray={ this.state.strokeDasharray }/>,
            Total = ({ value = this.state.total }) => <div className="total">{value}</div>,
            _error = this.state.error;
            
        return (
            <Fragment>
                { this.state.settings &&
                    <div>
                        { this.renderNav() }
                        { this.renderMap() }
                        <Status />
                        <Total />
                        <main id="app" className={_error ? "error live" : "live"}>
                            <section>
                                {_error &&
                                    <Fragment>
                                        <h1>{_error}</h1> 
                                        <button onClick={this.handleSettingsUpdate}>Check Settings</button>
                                    </Fragment>
                                }
                                { this.renderStats() }
                            </section>
                        </main>
                    </div>
                }
                { !this.state.settings &&
                    <div>
                        <main id="app">
                            <section>
                                <h1>Get a real-time dashboard from Google Analytics</h1>
                                <p>Configure with your own values and watch your website or app usage in real-time.<br />
                                <i>Need Help? <a href="https://hackernoon.com/using-the-google-real-time-reporting-api-71ce3f6ceee4" target="_blank">Read this post</a> or <a href="https://twitter.com/jessekorzan" target="_blank">@jessekorzan</a></i></p>
                                <Settings 
                                    handleSettingsUpdate={this.handleSettingsUpdate} 
                                    handleSettingsValue={this.handleSettingsValue} 
                                    { ...this.state } 
                                />
                            </section>
                        </main>
                    </div>
                }
            </Fragment>
        );
    }
}

export default App;

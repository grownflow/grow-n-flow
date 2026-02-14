import {useState} from 'react';
import './GillPopup.css';

function GillPopup({ gillText, active, onClose }) {

    return (
        <div>
            {active && (
                <div className="overlay"> 
                    <div className="popup">
                        <h2>Gill's Advice</h2>
                        <p>
                            {gillText}
                        </p>
                        <button className="close-button" onClick={() => onClose()}>
                            Close
                        </button>
                    </div>
                </div>
                )
            }
        </div>
    )
}

export default GillPopup;
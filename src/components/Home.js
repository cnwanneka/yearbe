
// Home.js
import React, { useState } from 'react';
import './Home.css';
import Product from './Product';
import DoubleBedsheetImage from '../images/double-bedsheet.jpg';
import SingleBedsheetImage from '../images/single-bedsheet.jpg';

function Home() {
  const [playVideo, setPlayVideo] = useState(false);

  const videoId = '6RwfNBtepa4';
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  return (
    <div className="home-container">
      <h1>Welcome to Yearbe</h1>

      {/* Artemis II live feed section */}
      <section className="live-feed-section">
        <h2 className="live-feed-title">NASA&apos;s Artemis II Live Views from Orion</h2>

        <div className="video-card">
          {!playVideo ? (
            <div
              className="video-thumbnail-wrapper"
              onClick={() => setPlayVideo(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setPlayVideo(true);
                }
              }}
            >
              <img
                src={thumbnailUrl}
                alt="NASA Artemis II Live Views from Orion"
                className="video-thumbnail"
              />
              <div className="play-button-overlay">
                <div className="play-button">&#9658;</div>
              </div>
            </div>
          ) : (
            <div className="video-wrapper">
              <iframe
                src={embedUrl}
                title="NASA's Artemis II Live Views from Orion"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              ></iframe>
            </div>
          )}
        </div>
      </section>

      <div className="products-container">
        <Product
          title="White Fitted Double Bedsheet"
          price="4.99"
          description="High quality double bedsheet"
          imageUrl={DoubleBedsheetImage}
          detailPath="/double-bedsheet"
        />
        <Product
          title="White Fitted Single Bedsheet"
          price="2.99"
          description="Comfortable single bedsheet"
          imageUrl={SingleBedsheetImage}
          detailPath="/single-bedsheet"
        />
      </div>
    </div>
  );
}

export default Home;
# SOURCE BTN - Tech & Science News Portal

A modern, liquid glass-themed news portal featuring real-time tech and science news with stunning visual effects.

## Features

- 🎨 **Liquid Glass Morphism Design** - Beautiful glassmorphic UI with liquid animations
- 🌊 **Animated Canvas Background** - Dynamic gradient blobs that flow like liquid
- 📰 **Real-Time News Integration** - Fetches latest news from NewsAPI and RSS feeds
- 📱 **Fully Responsive** - Works seamlessly on all devices
- ⚡ **Fast & Lightweight** - Optimized performance with vanilla JavaScript

## Technology Stack

- HTML5
- CSS3 (Glassmorphism, Animations)
- Vanilla JavaScript
- Canvas API for animations
- NewsAPI for real-time news
- RSS2JSON for backup news feeds

## Project Structure

```
tech-news-app/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # All CSS styles
├── js/
│   ├── background.js   # Canvas liquid animation
│   ├── news.js         # News API integration
│   └── animations.js   # Scroll reveal animations
├── assets/             # Static assets (if needed)
├── images/             # Image files (if needed)
└── README.md          # This file
```

## Setup Instructions

### 1. Clone or Extract the Project

Extract the ZIP file or clone to your desired location.

### 2. Configure News API (Optional but Recommended)

To display real news instead of demo content:

1. Get a free API key from [NewsAPI.org](https://newsapi.org/)
2. Open `js/news.js`
3. Replace the API key on line 2:
   ```javascript
   const NEWS_API_KEY = 'YOUR_API_KEY_HERE';
   ```

### 3. Run the Project

Simply open `index.html` in your web browser, or use a local server:

**Using Python:**
```bash
python -m http.server 8000
```

**Using Node.js:**
```bash
npx serve
```

**Using VS Code:**
Install "Live Server" extension and right-click `index.html` → "Open with Live Server"

## Development

### File Overview

**index.html**
- Main structure
- SVG filters for glass distortion effect
- Semantic HTML5 markup

**css/styles.css**
- Liquid glass morphism styles
- Responsive design
- Animations and transitions
- Grid layouts

**js/background.js**
- Canvas-based liquid blob animation
- Gradient background rendering
- Smooth blob movement physics

**js/news.js**
- NewsAPI integration
- RSS feed fallback
- Error handling
- News card rendering

**js/animations.js**
- Scroll-based reveal animations
- Intersection Observer implementation

## Customization

### Colors

Update the color palette in `js/background.js`:
```javascript
const colors = [
    { r: 95, g: 109, b: 120, a: 0.6 },   // Base color
    { r: 107, g: 122, b: 135, a: 0.5 },  // Lighter
    // Add more colors...
];
```

### News Categories

Modify categories in `js/news.js`:
```javascript
const categories = {
    'AI': 'artificial intelligence',
    'Q': 'quantum computing',
    // Add or modify categories...
};
```

### Animation Speed

Adjust blob speed in `js/background.js`:
```javascript
this.vx = (Math.random() - 0.5) * 0.5;  // Change multiplier
this.vy = (Math.random() - 0.5) * 0.5;  // Change multiplier
```

## Browser Support

- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

## Performance Tips

1. **Reduce Blob Count** - Lower `blobCount` in `background.js` for better performance
2. **Disable Blur** - Remove `ctx.filter = 'blur(60px)'` for faster rendering
3. **Lazy Load** - Images and cards load on demand

## Deployment

### GitHub Pages
1. Push to GitHub repository
2. Go to Settings → Pages
3. Select main branch
4. Save

### Netlify
1. Drag and drop the project folder
2. Site is live!

### Vercel
```bash
vercel --prod
```

## Troubleshooting

**News not loading?**
- Check console for API errors
- Verify API key is correct
- Try the RSS fallback
- Check internet connection

**Background not animating?**
- Ensure JavaScript is enabled
- Check browser console for errors
- Try a different browser

**Styling issues?**
- Clear browser cache
- Check CSS file is loaded
- Verify file paths are correct

## License

This project is open source and available for personal and commercial use.

## Credits

- Design: Liquid Glass Morphism
- Fonts: Google Fonts (Orbitron, Exo 2)
- News: NewsAPI.org
- Icons: SVG paths

## Support

For issues or questions, check:
- Browser console for errors
- Network tab for API issues
- File paths are correct

## Future Enhancements

- [ ] Dark/Light theme toggle
- [ ] Search functionality
- [ ] Category filters
- [ ] Bookmarking articles
- [ ] Social sharing
- [ ] RSS feed generation

---

Built with ❤️ using vanilla JavaScript and CSS

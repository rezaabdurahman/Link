# iOS App Store Deployment Checklist

## ✅ Completed Setup

### 1. Capacitor Configuration
- [x] Capacitor installed and configured
- [x] iOS platform added
- [x] Basic capacitor.config.ts configured with iOS settings
- [x] Splash screen and status bar plugins added

### 2. App Assets
- [x] App icon SVG created (`public/icons/app-icon.svg`)
- [x] Splash screen SVG created (`public/splash.svg`)
- [x] Icon generation script created (`scripts/generate-icons.js`)
- [x] App icon configuration added to iOS project

### 3. Legal Pages
- [x] Privacy Policy implemented (markdown-based)
- [x] Terms of Service implemented (markdown-based)
- [x] Legal routes added to app routing
- [x] Markdown rendering component created

### 4. Accessibility
- [x] Color contrast audit completed
- [x] Accessibility CSS improvements added
- [x] WCAG compliance improvements implemented
- [x] Screen reader support enhanced

### 5. iOS Metadata
- [x] Info.plist configured with permissions
- [x] App Store metadata file created
- [x] Web app manifest created
- [x] Production environment configured

## 🔄 Remaining Manual Steps

### 1. Install Development Dependencies (macOS)
```bash
# Install Xcode from App Store (required for iOS development)
# Install CocoaPods for iOS dependency management
sudo gem install cocoapods

# Install ImageMagick for icon generation
brew install imagemagick
```

### 2. Generate App Icons
```bash
# Generate all required iOS icon sizes
npm run generate-icons
```

### 3. Configure Xcode Project
```bash
# Build the web app
npm run build:production

# Copy web assets to iOS
npx cap copy ios

# Install iOS dependencies
cd ios/App && pod install && cd ../..

# Open Xcode project
npm run ios:open
```

### 4. Xcode Configuration
In Xcode, configure:
- **Bundle Identifier**: `com.link.app` (must be unique)
- **Team**: Your Apple Developer Team
- **Signing**: Automatic or Manual signing certificates
- **Version**: 1.0.0
- **Build Number**: 1 (increment for each submission)
- **Deployment Target**: iOS 13.0 or later

### 5. Backend Configuration
Before deploying, update these in `.env.production`:
- `VITE_API_BASE_URL`: Your actual production API URL
- `VITE_SENTRY_DSN`: Your actual Sentry DSN for error tracking

### 6. App Store Connect Setup
1. **Create App Record** in App Store Connect
2. **Upload App Icons** (1024x1024 for App Store)
3. **Add Screenshots** for different device sizes
4. **Complete App Information**:
   - Name: Link
   - Subtitle: Connect with people around you
   - Category: Social Networking
   - Keywords: social, networking, friends, meet, local, interests
   - Description: Use content from `app-store-metadata.json`
   - Privacy Policy URL: `https://link-app.com/privacy`
   - Terms of Service URL: `https://link-app.com/terms`

### 7. Required Screenshots
Generate screenshots for these device classes:
- **iPhone 6.7"**: 1242×2208 (portrait), 2208×1242 (landscape)
- **iPhone 6.5"**: 1125×2436 (portrait), 2436×1125 (landscape)  
- **iPhone 6.1"**: 828×1792 (portrait), 1792×828 (landscape)

Recommended screenshot content:
1. Discovery/Main feed page
2. User profile page
3. Chat/messaging interface
4. Onboarding flow
5. Settings/privacy controls

### 8. Testing Requirements
- [x] All unit tests passing
- [x] Build succeeds without errors
- [ ] Test on physical iOS device
- [ ] Test all core user flows
- [ ] Verify accessibility with VoiceOver
- [ ] Test in airplane mode/poor network
- [ ] Verify privacy controls work correctly

### 9. App Store Review Preparation
Review Apple's guidelines for:
- **Privacy**: Ensure privacy policy is comprehensive
- **Safety**: Implement user reporting and blocking features
- **Content**: Ensure all content meets App Store guidelines
- **Performance**: App loads quickly and responds smoothly
- **Design**: Follows iOS Human Interface Guidelines

### 10. Submission Process
```bash
# Final build for submission
npm run build:production
npm run ios:build

# Archive and upload in Xcode:
# 1. Product → Archive
# 2. Distribute App → App Store Connect
# 3. Upload
# 4. Submit for Review in App Store Connect
```

## 📋 Pre-Submission Checklist

### Technical
- [ ] App builds without errors
- [ ] All tests pass
- [ ] Performance testing completed
- [ ] Memory usage optimized
- [ ] Network error handling tested
- [ ] Offline functionality works (if applicable)

### Content & Legal
- [ ] Privacy policy comprehensive and accurate
- [ ] Terms of service legally reviewed
- [ ] All text content proofread
- [ ] Age rating appropriate (currently 4+)
- [ ] No copyrighted content without permission

### App Store Guidelines
- [ ] App follows iOS Human Interface Guidelines
- [ ] No prohibited content or functionality
- [ ] Privacy controls are prominent and functional
- [ ] User data handling is transparent
- [ ] App doesn't duplicate built-in iOS functionality

### Assets
- [ ] All app icons generated and included
- [ ] Screenshots captured for all required device sizes
- [ ] App Store icon (1024x1024) ready
- [ ] Launch screens work on all devices

## 🚨 Important Notes

1. **Bundle ID**: `com.link.app` must be registered in your Apple Developer account
2. **Certificates**: Ensure you have valid distribution certificates
3. **Privacy**: Location and camera permissions must be clearly justified
4. **Backend**: Ensure your production API is ready and configured
5. **Testing**: Test thoroughly on real devices before submission

## 🔗 Useful Resources

- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [Capacitor iOS Guide](https://capacitorjs.com/docs/ios)

## Support

For questions about this deployment setup, refer to:
- `app-store-metadata.json` for App Store listing details
- `src/content/legal/` for privacy policy and terms content
- `capacitor.config.ts` for iOS app configuration

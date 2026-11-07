# In-app dialogs

App-owned notices and confirmations in both account experiences use `Alert` from
`src/services/appAlert.ts`, rendered by `AppAlertHost` once in `App.tsx` outside
navigation and authentication. Do not import `Alert` from `react-native` for new
screens. The OS still owns camera/location permission prompts and the Google
sign-in interface.

The shared dialog uses the forest/sage/cream theme, rounded corners, full-width
actions, a short fade that respects reduced motion, and safe-area padding. Long
messages and action labels wrap and scroll within the available screen height.
The keyboard is dismissed when a dialog opens. Screen-reader focus moves to its
heading; web modals use React Native Web's focus containment and restoration.

The API retains the existing title/message/buttons/options shape. Buttons retain
their callbacks and cancel/destructive styles; Cancel is displayed after the
affirmative action. Destructive actions stay explicitly labelled and red. With
no buttons, a single **Got it** action acknowledges the notice. Backdrop/Android
Back/Escape dismissal requires `cancelable: true` and calls only `onDismiss`.
They never accept a confirmation. Dialogs queue in order, including ones raised
before the host mounts or from another dialog's callback. Stale and double taps
cannot run the same action twice.

Validation: queue/callback regression tests, TypeScript, Android/web exports,
and isolated browser checks using the real host and Business onboarding screen
at 390×844 and 320×500. The preview has no backend configuration and does not
delete or modify real records. Check TalkBack/VoiceOver, large system text, safe
areas and hardware Back on a phone build before release.

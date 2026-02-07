// This is a placeholder route for the Add button in the tab bar
// The actual functionality is handled by navigation to my-jobs with openAdd param
import { Redirect } from 'expo-router';

export default function AddPlaceholder() {
  return <Redirect href="/(tabs)/my-jobs" />;
}

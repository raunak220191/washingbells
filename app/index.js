import { Redirect } from "expo-router";
import { useAuthStore } from "../stores/authStore";
import LoadingScreen from "../components/common/LoadingScreen";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return <LoadingScreen />;

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(authenticate)/login" />;
}


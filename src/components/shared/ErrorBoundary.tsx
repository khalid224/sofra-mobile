import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
    this.setState({ errorInfo: info.componentStack ?? "" });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: "#FAFAFA", padding: 24, justifyContent: "center" }}>
          <View style={{ backgroundColor: "#FEF2F2", borderRadius: 20, padding: 24, borderWidth: 1, borderColor: "#FECACA" }}>
            <Text style={{ fontFamily: "System", fontSize: 40, textAlign: "center", marginBottom: 12 }}>⚠️</Text>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A0A05", textAlign: "center", marginBottom: 8 }}>
              حدث خطأ في التطبيق
            </Text>
            <Text style={{ fontSize: 13, color: "#71574B", textAlign: "center", marginBottom: 20, lineHeight: 20 }}>
              {this.state.error?.message ?? "خطأ غير متوقع"}
            </Text>
            <Pressable
              onPress={() => this.setState({ hasError: false, error: null, errorInfo: "" })}
              style={{ backgroundColor: "#4A2A1F", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>حاول مجدداً</Text>
            </Pressable>
          </View>

          {/* Dev mode: show stack trace */}
          {__DEV__ && this.state.errorInfo ? (
            <ScrollView style={{ marginTop: 16, maxHeight: 200 }}>
              <Text style={{ fontSize: 10, color: "#999", fontFamily: "monospace" }}>
                {this.state.errorInfo}
              </Text>
            </ScrollView>
          ) : null}
        </View>
      );
    }
    return this.props.children;
  }
}

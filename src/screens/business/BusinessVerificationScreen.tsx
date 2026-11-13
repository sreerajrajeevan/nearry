import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BusinessStackParamList } from "../../navigation/types";
import { BusinessProfileScreen } from "./BusinessProfileScreen";

/** The same private document/review flow used by the Business tab. */
export function BusinessVerificationScreen({
  navigation,
}: NativeStackScreenProps<BusinessStackParamList, "BusinessVerification">) {
  return (
    <BusinessProfileScreen
      navigation={navigation}
      verificationOnly
      onCreateOffer={() =>
        navigation.navigate("BusinessTabs", { screen: "CreateOffer" })
      }
    />
  );
}

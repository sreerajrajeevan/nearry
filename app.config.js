module.exports = ({ config }) => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const configuredId = config.extra?.eas?.projectId;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim();
  if (projectId && configuredId && projectId !== configuredId)
    throw new Error(
      "EAS project IDs disagree. Use the same project for builds and push notifications.",
    );
  return {
    ...config,
    ...(googleServicesFile && {
      android: { ...config.android, googleServicesFile },
    }),
    ...(projectId && {
      extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } },
    }),
  };
};

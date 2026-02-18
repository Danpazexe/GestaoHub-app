const LIGHT_ROUTE_HEADER_COLORS = {
  EntryScreen: '#ffffff',
  LoginScreen: '#ffffff',
  RegisterScreen: '#ffffff',
  HomeScreen: '#f7f7f8',
  ListScreen: '#2563eb',
  AddProductScreen: '#059669',
  DashboardScreen: '#7c3aed',
  SettingsScreen: '#374151',
  ProfileScreen: '#f7f7f8',
  NotificationSettings: '#6cb6a5',
  SqlScreen: '#2563EB',
  TratarScreen: '#c2410c',
  ExcelScreen: '#012677',
  PdfScreen: '#d7263d',
  PdfViewerScreen: '#294380',
  BarcodeScannerScreen: '#000000',
  AvariaListScreen: '#334155',
  AvariaEntryScreen: '#b91c1c',
  AvariaResolutionScreen: '#065f46',
  AvariaHistoryScreen: '#4c1d95',
  AvariaDashboardScreen: '#c2410c',
};

const DARK_ROUTE_HEADER_COLORS = {
  EntryScreen: '#2f333a',
  LoginScreen: '#2f333a',
  RegisterScreen: '#2f333a',
  HomeScreen: '#2f333a',
  ListScreen: '#2563eb',
  AddProductScreen: '#059669',
  DashboardScreen: '#7c3aed',
  SettingsScreen: '#1F2937',
  ProfileScreen: '#2f333a',
  NotificationSettings: '#1a4645',
  SqlScreen: '#1E40AF',
  TratarScreen: '#c2410c',
  ExcelScreen: '#012677',
  PdfScreen: '#d7263d',
  PdfViewerScreen: '#294380',
  BarcodeScannerScreen: '#000000',
  AvariaListScreen: '#334155',
  AvariaEntryScreen: '#b91c1c',
  AvariaResolutionScreen: '#065f46',
  AvariaHistoryScreen: '#4c1d95',
  AvariaDashboardScreen: '#c2410c',
};

const resolveRoute = (route) => {
  if (typeof route === 'string') {
    return { routeName: route, routeParams: undefined };
  }

  return {
    routeName: route?.name,
    routeParams: route?.params,
  };
};

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '');
  const isShort = normalized.length === 3;
  const full = isShort
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const num = parseInt(full, 16);

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

export const isColorDark = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.6;
};

export const getRouteHeaderBackground = (route, isDarkMode) => {
  const { routeName, routeParams } = resolveRoute(route);

  if (routeName === 'ModuleFunctionsScreen') {
    return routeParams?.module?.color || '#334155';
  }

  const palette = isDarkMode ? DARK_ROUTE_HEADER_COLORS : LIGHT_ROUTE_HEADER_COLORS;
  return palette[routeName] || (isDarkMode ? '#2f333a' : '#f7f7f8');
};

export const getStatusBarStyle = (routeName) => {
  if (routeName === 'HomeScreen') {
    return 'dark-content';
  }

  return 'light-content';
};

export const getNavigationBarColor = (route, isDarkMode) => {
  const { routeName } = resolveRoute(route);

  if (routeName === 'BarcodeScannerScreen' || routeName === 'HomeScreen') {
    return 'transparent';
  }

  return getRouteHeaderBackground(route, isDarkMode);
};

export const shouldUseDarkNavigationBarIcons = (route, isDarkMode) => {
  const { routeName } = resolveRoute(route);

  if (routeName === 'HomeScreen') {
    return true;
  }

  const navBarColor = getNavigationBarColor(route, isDarkMode);
  if (navBarColor === 'transparent') {
    return false;
  }

  return !isColorDark(navBarColor);
};

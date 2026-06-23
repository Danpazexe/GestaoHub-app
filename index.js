import 'react-native-url-polyfill/auto';
import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Warning benigno (apenas em dev) emitido por animações de libs como
// react-native-gifted-charts / react-native-animatable: uma animação no driver
// nativo atualiza um valor sem listener JS registrado. Não afeta build de produção.
// Suprimimos APENAS esse aviso para não poluir o LogBox (os demais continuam visíveis).
LogBox.ignoreLogs([/onAnimatedValueUpdate/]);

AppRegistry.registerComponent(appName, () => App);

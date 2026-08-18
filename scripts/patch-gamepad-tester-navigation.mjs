import fs from 'node:fs';

const file = 'src/App.tsx';
let src = fs.readFileSync(file, 'utf8');

if (!src.includes('import GamepadTester from "./components/GamepadTester";')) {
  src = src.replace(
    'import RepairCenter from "./components/RepairCenter";',
    'import RepairCenter from "./components/RepairCenter";\nimport GamepadTester from "./components/GamepadTester";'
  );
}

if (!src.includes('{ id: "gamepad-tester", label: "فحص الدراعات"')) {
  src = src.replace(
    '{ id: "repair-center", label: "مركز الصيانة والورشة", icon: Wrench },',
    '{ id: "repair-center", label: "مركز الصيانة والورشة", icon: Wrench },\n    { id: "gamepad-tester", label: "فحص الدراعات", icon: Smartphone },'
  );
}

if (!src.includes('case "gamepad-tester": return <GamepadTester />;')) {
  src = src.replace(
    'case "repair-center": return <RepairCenter initialStatusFilter={navigationParams?.status} initialOrderId={navigationParams?.orderId} />;',
    'case "repair-center": return <RepairCenter initialStatusFilter={navigationParams?.status} initialOrderId={navigationParams?.orderId} />;\n      case "gamepad-tester": return <GamepadTester />;'
  );
}

fs.writeFileSync(file, src);
console.log('✓ Gamepad tester navigation wired');

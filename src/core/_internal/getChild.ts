/** Child access from library code: a proxyless build has no trap for it. */
const getChild: (control: any, prop: any) => any =
  typeof __CONTROLLA_PROXYLESS__ != 'undefined' && __CONTROLLA_PROXYLESS__
    ? (control, prop) => control.a(prop)
    : (control, prop) => control[prop];

export default getChild;

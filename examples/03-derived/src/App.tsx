/**
 * Computing from other controls.
 *
 * A derived control recomputes when its sources change and dedupes on the
 * result: if the computed value is the same as last time, nobody re-renders.
 * That is the difference from just reading both sources in a component, and the
 * reason the "shipping" line below stops re-rendering once you are over the
 * threshold - the total keeps moving, the boolean does not.
 */

import createControl from 'controlla/core/createControl';
import createControlsContext from 'controlla/core/createControlsContext';
import createDerivedControl from 'controlla/core/createDerivedControl';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';
import ControlConsumer from 'controlla/core/ControlConsumer';
import ControlsConsumer from 'controlla/core/ControlsConsumer';
import CombinedControlsConsumer from 'controlla/core/CombinedControlsConsumer';
import { useRef, type FC } from 'react';

type Line = { sku: string; label: string; unitPrice: number; quantity: number };

const FREE_SHIPPING_FROM = 500;

/**
 * A cart and everything computed from it, in one bag - a derived control is
 * declared exactly like a plain one, and belongs wherever its sources do. None of
 * this is module-level: a cart is one shopper's, and a control at module scope is
 * one value for every visitor at once.
 */
const [CartProvider, useCart] = createControlsContext(() => {
  const $cart = createControl<{ lines: Line[]; currency: 'EUR' | 'USD' }>({
    currency: 'EUR',
    lines: [
      { sku: 'DSK-11', label: 'Standing desk', unitPrice: 289, quantity: 1 },
      { sku: 'CHR-04', label: 'Task chair', unitPrice: 149, quantity: 2 },
      { sku: 'LMP-02', label: 'Desk lamp', unitPrice: 39, quantity: 1 },
    ],
  });

  /** Recomputes when `lines` changes; dedupes when the number comes out the same. */
  const $total = createDerivedControl($cart.lines, (lines) =>
    lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  );

  return {
    $cart,
    $total,
    /** Derived from a derived control - they compose like any other source. */
    $qualifiesForFreeShipping: createDerivedControl(
      $total,
      (total) => total >= FREE_SHIPPING_FROM
    ),
  };
});

const Renders: FC<{ of: string }> = ({ of }) => {
  const rerenderCountRef = useRef(0);

  rerenderCountRef.current++;

  return (
    <span className='count'>
      {of}: {rerenderCountRef.current}
    </span>
  );
};

const QuantityStepper: FC<{ index: number }> = ({ index }) => {
  const $line = useCart().$cart.lines[index];

  const quantity = useValue($line.quantity);

  return (
    <span className='row'>
      <button
        disabled={quantity === 0}
        onClick={() => setValue($line.quantity, (n) => n - 1)}
      >
        -
      </button>
      <span style={{ minWidth: '2ch', textAlign: 'center' }}>{quantity}</span>
      <button onClick={() => setValue($line.quantity, (n) => n + 1)}>+</button>
    </span>
  );
};

const Lines: FC = () => (
  <ControlConsumer
    control={useCart().$cart.lines}
    render={(lines) => (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.sku}>
              <td>{line.label}</td>
              <td className='muted'>{line.unitPrice}</td>
              <td>
                <QuantityStepper index={index} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  />
);

const Total: FC = () => {
  const { $cart, $total, $qualifiesForFreeShipping } = useCart();

  return (
    <fieldset>
      <legend>Total</legend>
      <p>
        {/* one derived control, one subscriber */}
        <ControlConsumer control={$total} />{' '}
        <ControlConsumer control={$cart.currency} />
      </p>
      <p>
        <CombinedControlsConsumer
          controls={[$qualifiesForFreeShipping, $total]}
          combiner={(qualifies, total) =>
            qualifies ? 'free' : `${FREE_SHIPPING_FROM - total} to go`
          }
          render={(label) => (
            <>
              <Renders of='shipping' />
              Shipping: {label}
            </>
          )}
        />
      </p>
      <p className='muted'>
        The shipping counter moves only when the message changes - the combiner
        collapses a moving total into a stable string.
      </p>
    </fieldset>
  );
};

const Summary: FC = () => {
  const { $cart, $total } = useCart();

  return (
    <fieldset>
      <legend>Reading several controls at once</legend>
      <p>
        {/* ControlsConsumer re-runs on any source change - no deduping. Use it
            when you genuinely want every update. */}
        <ControlsConsumer
          controls={[$total, $cart.currency, $cart.lines.length]}
          render={(total, currency, lineCount) => (
            <>
              <Renders of='summary' />
              {lineCount} lines, {total} {currency}
            </>
          )}
        />
      </p>
      <button
        onClick={() =>
          setValue($cart.currency, (c) => (c === 'EUR' ? 'USD' : 'EUR'))
        }
      >
        switch currency
      </button>
    </fieldset>
  );
};

const App: FC = () => (
  <CartProvider>
    <h1>Derived controls</h1>
    <p className='lede'>
      Change a quantity: the total re-renders every time, the free-shipping line
      only when it flips.
    </p>

    <fieldset>
      <legend>Cart</legend>
      <Lines />
    </fieldset>

    <Total />
    <Summary />
  </CartProvider>
);

export default App;

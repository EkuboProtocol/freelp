import { Trans } from "@lingui/react/macro";
export function TermsPage() {
  return (
    <section className="terms-page">
      <h2>
        <Trans>Terms of Service</Trans>
      </h2>
      <h3>
        <Trans>Entirely at your own risk</Trans>
      </h3>
      <p>
        <Trans>
          You alone decide whether and how to use FreeLP, this website, any copy
          of the application, or any contract accessed through it. You assume
          all risks and responsibility for your actions, transactions,
          permissions, and losses. You can lose all assets you commit or
          approve. Transactions may be irreversible, and assets may be
          permanently inaccessible.
        </Trans>
      </p>
      <h3>
        <Trans>No central operator or protection</Trans>
      </h3>
      <p>
        <Trans>
          FreeLP is independently runnable, noncustodial software. Its position
          manager has no protocol owner or administrator appointed to supervise
          your activity, manage your positions, reverse transactions, or recover
          your assets. Nobody undertakes to protect you merely because they
          wrote, contributed to, deployed, distributed, or hosted this software.
          Your wallet and position ownership do not create a customer, agency,
          fiduciary, or custodial relationship with any contributor.
        </Trans>
      </p>
      <p>
        <Trans>
          This does not mean every token, extension, network, RPC endpoint,
          gateway, or other contract is ownerless. Those systems may have
          independent owners, administrators, upgrade powers, or restrictions.
          Their inclusion or availability through FreeLP is not an endorsement
          or a promise of safety. Software copyright and applicable license
          notices remain in effect.
        </Trans>
      </p>
      <h3>
        <Trans>No warranties or guarantees</Trans>
      </h3>
      <p>
        <Trans>
          To the fullest extent permitted by law, the application, website,
          information, and contract interactions are provided as is and as
          available, with no express, implied, or statutory warranty. This
          includes no warranty of merchantability, fitness for a purpose, title,
          noninfringement, accuracy, security, reliability, or availability.
        </Trans>
      </p>
      <p>
        <Trans>
          There is no guarantee that any contract is correct, audited, secure,
          economically sound, or free from defects, exploits, malicious
          behavior, or administrative intervention. No one promises returns,
          liquidity, price accuracy, execution quality, asset value, withdrawal
          availability, recovery, refunds, insurance, compensation, continued
          hosting, updates, maintenance, or support. Simulation results,
          displayed balances, prices, and fee estimates may be incomplete,
          stale, or wrong.
        </Trans>
      </p>
      <h3>
        <Trans>Your responsibility</Trans>
      </h3>
      <p>
        <Trans>
          You are responsible for evaluating the software and every network,
          contract, extension, token, RPC endpoint, wallet, approval, recipient,
          amount, and transaction before using or signing anything. Risks
          include total loss, contract failures, malicious assets, unlimited
          approvals, compromised wallets or infrastructure, inaccurate data,
          price movements, liquidity losses, transaction ordering, network
          failures, and changes to external systems. Nothing here is investment,
          legal, tax, or other professional advice. You are responsible for
          complying with laws and obligations applicable to you.
        </Trans>
      </p>
      <h3>
        <Trans>Limitation of liability</Trans>
      </h3>
      <p>
        <Trans>
          To the maximum extent permitted by applicable law, no author,
          copyright holder, contributor, maintainer, distributor, deployer, or
          host accepts liability for any claim, loss, damage, cost, or other
          liability arising from your use of, inability to use, or reliance on
          this application, website, software, information, or any connected
          contract or system. This includes lost assets, profits, data,
          opportunities, and direct, indirect, incidental, consequential,
          special, exemplary, or punitive damages, under contract, tort
          including negligence, or any other legal theory, even if advised of
          the possibility. You bear the consequences of what you do with this
          software. No statement here excludes liability or rights that
          applicable law does not permit to be excluded.
        </Trans>
      </p>
      <h3>
        <Trans>MIT license</Trans>
      </h3>
      <p>
        <Trans>
          FreeLP software is licensed under the MIT license. These notices do
          not narrow the permissions granted by that license, waive copyright,
          or replace the licenses of included components. The MIT warranty
          disclaimer and limitation of liability continue to apply. Preserve
          required copyright and license notices when copying or distributing
          the software.
        </Trans>
      </p>
      <a href="./licenses/freelp.txt">
        <Trans>Read the MIT license</Trans>
      </a>
    </section>
  );
}

import { graphIds, graphs, graphTitles } from "@/lib/graphs";

/**
 * The x-ray as text: every view and what it says about each node, for assistive tech and
 * crawlers. The graph only shows a node's details once it's zoomed into; this is always there
 * (and in the prerendered page). Visually hidden, so it uses the x-ray's own wording. Its own
 * landmark after `<main>`, so reading the page gets the hero first. It shares the x-ray's name
 * ("Infrastructure"), but never at the same time: whichever isn't showing is `inert`.
 */
export const InfraOutline = ({ inert }: { inert?: boolean }) => (
  <aside aria-labelledby="infra-outline-title" inert={inert} className="sr-only">
    <h2 id="infra-outline-title">Infrastructure</h2>
    {graphIds.map((graphId) => {
      const graph = graphs[graphId];
      return (
        <section key={graphId} aria-labelledby={`infra-outline-${graphId}`}>
          <h3 id={`infra-outline-${graphId}`}>{graphTitles[graphId]}</h3>
          <p>{graph.description}</p>
          {graph.nodes.map((node) => {
            const details = graph.details[node.id];
            if (!details) return null;
            return (
              <article key={node.id}>
                <h4>{`${node.label} · ${node.detail}`}</h4>
                <p>{details.summary}</p>
                {details.decisions.length > 0 && (
                  <>
                    <h5>Why it’s built this way</h5>
                    <ul>
                      {details.decisions.map((decision) => (
                        <li key={decision}>{decision}</li>
                      ))}
                    </ul>
                  </>
                )}
                {details.stack.length > 0 && (
                  <>
                    <h5>Components</h5>
                    <ul>
                      {details.stack.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}
              </article>
            );
          })}
        </section>
      );
    })}
  </aside>
);

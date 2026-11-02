import styles from './DataTable.module.scss'

export interface DataTableProps {
  headerList: string[]
  rowList: string[][]
}

/**
 * 見出し行付きの単純な表。
 *
 * @param props
 * @param props.headers 見出し行。
 * @param props.rowList 本体の行。
 * @returns 描画結果。
 */
export function DataTable({ headerList, rowList }: DataTableProps) {
  return (
    <div className={styles.wrap}>
      <table>
        <thead>
          <tr>
            {headerList.map((header, index) => (
              <th key={index} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowList.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

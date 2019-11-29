import { useRef } from 'react'
import { defaultState } from '../hooks/useTable'
import { defaultColumn, getFirstDefined } from '../utils'
import { mergeProps, applyPropHooks } from '../utils'

defaultState.columnResizing = {
  columnWidths: {},
}

defaultColumn.canResize = true

export const useResizeColumns = hooks => {
  hooks.useBeforeDimensions.push(useBeforeDimensions)
}

useResizeColumns.pluginName = 'useResizeColumns'

const useBeforeDimensions = instance => {
  instance.hooks.getResizerProps = []

  const {
    flatHeaders,
    disableResizing,
    hooks: { getHeaderProps },
    state: { columnResizing },
    setState,
  } = instance

  getHeaderProps.push(() => {
    return {
      style: {
        position: 'relative',
      },
    }
  })

  const onMouseDown = (e, header) => {
    const headersToResize = getLeafHeaders(header)
    const startWidths = headersToResize.map(header => header.totalWidth)
    const startX = e.clientX

    const onMouseMove = e => {
      const currentX = e.clientX
      const deltaX = currentX - startX

      const percentageDeltaX = deltaX / headersToResize.length

      const newColumnWidths = {}
      headersToResize.forEach((header, index) => {
        newColumnWidths[header.id] = Math.max(
          startWidths[index] + percentageDeltaX,
          0
        )
      })

      setState(old => ({
        ...old,
        columnResizing: {
          ...old.columnResizing,
          columnWidths: {
            ...old.columnResizing.columnWidths,
            ...newColumnWidths,
          },
        },
      }))
    }

    const onMouseUp = e => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)

      setState(old => ({
        ...old,
        columnResizing: {
          ...old.columnResizing,
          startX: null,
          isResizingColumn: null,
        },
      }))
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    setState(old => ({
      ...old,
      columnResizing: {
        ...old.columnResizing,
        startX,
        isResizingColumn: header.id,
      },
    }))
  }

  // use reference to avoid memory leak in #1608
  const instanceRef = useRef()
  instanceRef.current = instance

  flatHeaders.forEach(header => {
    const canResize = getFirstDefined(
      header.disableResizing === true ? false : undefined,
      disableResizing === true ? false : undefined,
      true
    )

    header.canResize = canResize
    header.width = columnResizing.columnWidths[header.id] || header.width
    header.isResizing = columnResizing.isResizingColumn === header.id

    if (canResize) {
      header.getResizerProps = userProps => {
        return mergeProps(
          {
            onMouseDown: e => e.persist() || onMouseDown(e, header),
            style: {
              cursor: 'ew-resize',
            },
            draggable: false,
          },
          applyPropHooks(
            instanceRef.current.hooks.getResizerProps,
            header,
            instanceRef.current
          ),
          userProps
        )
      }
    }
  })

  return instance
}

function getLeafHeaders(header) {
  const leafHeaders = []
  const recurseHeader = header => {
    if (header.columns && header.columns.length) {
      header.columns.map(recurseHeader)
    }
    leafHeaders.push(header)
  }
  recurseHeader(header)
  return leafHeaders
}

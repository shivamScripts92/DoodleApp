import { useEffect, useLayoutEffect, useRef } from "react";
import { useSelector, useDispatch } from 'react-redux'
import { MENU_ITEMS } from "@/constants";
import { actionItemClick } from '@/slice/menuSlice'
import { socket } from "@/socket";

const Board = () => {
    const dispatch = useDispatch()
    const canvasRef = useRef(null)
    const drawHistory = useRef([])
    const historyPointer = useRef(-1)
    const shouldDraw = useRef(false)
    const { activeMenuItem, actionMenuItem } = useSelector((state) => state.menu)
    const { color, size } = useSelector((state) => state.toolbox[activeMenuItem])

    useEffect(() => {
        if (!canvasRef.current) return
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        if (actionMenuItem === MENU_ITEMS.DOWNLOAD) {
            const URL = canvas.toDataURL()
            const anchor = document.createElement('a')
            anchor.href = URL
            anchor.download = 'sketch.jpg'
            anchor.click()
        } else if (actionMenuItem === MENU_ITEMS.UNDO || actionMenuItem === MENU_ITEMS.REDO) {
            if (actionMenuItem === MENU_ITEMS.UNDO && historyPointer.current > 0) historyPointer.current--
            if (actionMenuItem === MENU_ITEMS.REDO && historyPointer.current < drawHistory.current.length - 1) historyPointer.current++
            if (historyPointer.current >= 0) {
                context.putImageData(drawHistory.current[historyPointer.current], 0, 0)
            } else {
                context.clearRect(0, 0, canvas.width, canvas.height)
            }
        }
        dispatch(actionItemClick(null))
    }, [actionMenuItem, dispatch])

    useEffect(() => {
        if (!canvasRef.current) return
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')

        const effectiveColor = activeMenuItem === MENU_ITEMS.ERASER ? "rgba(0,0,0,1)" : color
        context.strokeStyle = effectiveColor
        context.lineWidth = size
        context.globalCompositeOperation = activeMenuItem === MENU_ITEMS.ERASER ? "destination-out" : "source-over"

        socket.emit('changeConfig', { color: effectiveColor, size, mode: context.globalCompositeOperation })
        const handleChangeConfig = (config) => {
            context.strokeStyle = config.color
            context.lineWidth = config.size
            context.globalCompositeOperation = config.mode
        }
        socket.on('changeConfig', handleChangeConfig)
        return () => socket.off('changeConfig', handleChangeConfig)
    }, [color, size, activeMenuItem])

    useLayoutEffect(() => {
        if (!canvasRef.current) return
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const beginPath = (x, y) => {
            context.beginPath()
            context.moveTo(x, y)
        }
        const drawLine = (x, y) => {
            context.lineTo(x, y)
            context.stroke()
        }

        const handleMouseDown = (e) => {
            shouldDraw.current = true
            const x = e.clientX || e.touches[0].clientX
            const y = e.clientY || e.touches[0].clientY
            beginPath(x, y)
            socket.emit('beginPath', { x, y })
        }
        const handleMouseMove = (e) => {
            if (!shouldDraw.current) return
            const x = e.clientX || e.touches[0].clientX
            const y = e.clientY || e.touches[0].clientY
            drawLine(x, y)
            socket.emit('drawLine', { x, y })
        }
        const handleMouseUp = () => {
            shouldDraw.current = false
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
            if (historyPointer.current < drawHistory.current.length - 1) {
                drawHistory.current = drawHistory.current.slice(0, historyPointer.current + 1)
            }
            drawHistory.current.push(imageData)
            historyPointer.current = drawHistory.current.length - 1
        }

        const handleBeginPath = ({ x, y }) => beginPath(x, y)
        const handleDrawLine = ({ x, y }) => drawLine(x, y)

        canvas.addEventListener('mousedown', handleMouseDown)
        canvas.addEventListener('mousemove', handleMouseMove)
        canvas.addEventListener('mouseup', handleMouseUp)
        canvas.addEventListener('touchstart', handleMouseDown)
        canvas.addEventListener('touchmove', handleMouseMove)
        canvas.addEventListener('touchend', handleMouseUp)

        socket.on('beginPath', handleBeginPath)
        socket.on('drawLine', handleDrawLine)

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown)
            canvas.removeEventListener('mousemove', handleMouseMove)
            canvas.removeEventListener('mouseup', handleMouseUp)
            canvas.removeEventListener('touchstart', handleMouseDown)
            canvas.removeEventListener('touchmove', handleMouseMove)
            canvas.removeEventListener('touchend', handleMouseUp)
            socket.off('beginPath', handleBeginPath)
            socket.off('drawLine', handleDrawLine)
        }
    }, [])

    return <canvas ref={canvasRef}></canvas>
}

export default Board

module.exports = (req, res, next) => {
    if (req.url === '/shipmentsMissing') {
        res.status(404)
        res.jsonp({
            error: 'missing record'
        })
    }

    res.header('Server', 'Mock OCP API')
    next()
}
